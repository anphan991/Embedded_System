import tempfile
import unittest
from pathlib import Path

import database


class ZoneConfigTests(unittest.TestCase):
    def setUp(self):
        self.original_db_path = database.DB_PATH
        self.temp_dir = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent)
        database.DB_PATH = str(Path(self.temp_dir.name) / "zones-test.db")
        database.init_db()

    def tearDown(self):
        database.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def test_update_replaces_zones_and_normalizes_type_and_name(self):
        database.update_zones([{
            "type": " danger ",
            "name": "  Balcony  ",
            "x_min": 1,
            "x_max": 2.5,
            "y_min": 0.5,
            "y_max": 3,
        }])

        self.assertEqual(database.get_all_zones(), [{
            "type": "DANGER",
            "name": "Balcony",
            "x_min": 1.0,
            "x_max": 2.5,
            "y_min": 0.5,
            "y_max": 3.0,
        }])

    def test_invalid_bounds_do_not_replace_existing_zones(self):
        original = database.get_all_zones()

        with self.assertRaisesRegex(ValueError, "minimums"):
            database.update_zones([{
                "type": "SAFE",
                "name": "Invalid",
                "x_min": 2,
                "x_max": 1,
                "y_min": 0,
                "y_max": 1,
            }])

        self.assertEqual(database.get_all_zones(), original)

    def test_non_finite_coordinates_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "finite"):
            database.update_zones([{
                "type": "SAFE",
                "name": "Invalid",
                "x_min": float("nan"),
                "x_max": 1,
                "y_min": 0,
                "y_max": 1,
            }])

    def test_zone_outside_room_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "inside the configured room"):
            database.update_zones([{
                "type": "DANGER",
                "name": "Outside",
                "x_min": 5,
                "x_max": 7,
                "y_min": 0,
                "y_max": 1,
            }])

    def test_zone_contains_boundary_points_but_not_outside_points(self):
        zone = {"x_min": 1, "x_max": 2, "y_min": 3, "y_max": 4}

        self.assertTrue(database.point_in_zone(1, 3, zone))
        self.assertTrue(database.point_in_zone(2, 4, zone))
        self.assertFalse(database.point_in_zone(2.01, 4, zone))
        self.assertFalse(database.point_in_zone(float("nan"), 3.5, zone))


if __name__ == "__main__":
    unittest.main()
