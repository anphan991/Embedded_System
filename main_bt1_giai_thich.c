/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * @file           : main.c
  * @brief          : LDR + LCD 16x2 + LED
  ******************************************************************************
  */
/* USER CODE END Header */

/* Includes ------------------------------------------------------------------*/
/* main.h chứa khai báo HAL, tên chân GPIO và các kiểu dữ liệu của dự án CubeMX. */
#include "main.h"

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */
/* stdio.h cung cấp snprintf() để ghép số ADC thành chuỗi hiển thị. */
#include <stdio.h>
/* string.h đang được giữ từ dự án gốc; đoạn chương trình này chưa gọi hàm của nó. */
#include <string.h>
/* USER CODE END Includes */

/* Private variables ---------------------------------------------------------*/
/* hadc1 là cấu trúc HAL quản lý ADC1, được dùng khi bắt đầu và đọc phép đo. */
ADC_HandleTypeDef hadc1;
/* huart1 quản lý USART1; trong bài này UART được khởi tạo nhưng chưa truyền dữ liệu. */
UART_HandleTypeDef huart1;

/* USER CODE BEGIN PV */

/* Giữ mẫu ADC gần nhất. Nếu lần đọc sau bị timeout, biến vẫn giữ giá trị cũ. */
uint32_t adc_value = 0;

/* LCD có 16 cột: cần 16 byte ký tự và thêm 1 byte '\0' kết thúc chuỗi C. */
char lcd_line1[17];
char lcd_line2[17];

/* USER CODE END PV */

/* Private define ------------------------------------------------------------*/
/* USER CODE BEGIN PD */

/* Ngưỡng so sánh ADC thô, chưa phải lux. ADC 12 bit có thang 0..4095. */
#define LDR_THRESHOLD 2000

/* LCD PIN */
/* LCD chạy chế độ 4 bit: RS chọn lệnh/dữ liệu, E chốt dữ liệu, D4..D7 mang 4 bit. */
/* R/W của LCD cần nối GND trong Proteus vì chương trình chỉ ghi, không đọc LCD. */
#define LCD_RS_PORT GPIOB
#define LCD_RS_PIN  GPIO_PIN_1

#define LCD_E_PORT  GPIOB
#define LCD_E_PIN   GPIO_PIN_10

#define LCD_D4_PORT GPIOB
#define LCD_D4_PIN  GPIO_PIN_11

#define LCD_D5_PORT GPIOB
#define LCD_D5_PIN  GPIO_PIN_12

#define LCD_D6_PORT GPIOB
#define LCD_D6_PIN  GPIO_PIN_13

#define LCD_D7_PORT GPIOB
#define LCD_D7_PIN  GPIO_PIN_14

/* USER CODE END PD */

/* Private function prototypes -----------------------------------------------*/
/* Khai báo trước để main() có thể gọi các hàm được định nghĩa ở cuối tệp. */
void SystemClock_Config(void);
static void MX_GPIO_Init(void);
static void MX_ADC1_Init(void);
static void MX_USART1_UART_Init(void);

/* USER CODE BEGIN PFP */

/* Các hàm bên dưới tạo giao tiếp với LCD tương thích HD44780 ở chế độ 4 bit. */
void LCD_Init(void);
void LCD_SendCommand(uint8_t cmd);
void LCD_SendData(uint8_t data);
void LCD_SendString(char *str);
void LCD_SetCursor(uint8_t row, uint8_t col);
void LCD_Send4Bits(uint8_t data);

/* USER CODE END PFP */


/* USER CODE BEGIN 0 */


/* 
 * GUI 4 BIT RA LCD*/
void LCD_Send4Bits(uint8_t data)
{
    /* Mỗi phép AND kiểm tra một bit của data: 1 -> chân SET, 0 -> chân RESET. */
    /* Bit 0, 1, 2, 3 lần lượt được đưa ra LCD D4, D5, D6, D7. */
    HAL_GPIO_WritePin(LCD_D4_PORT,
                      LCD_D4_PIN,
                      (data & 0x01) ? GPIO_PIN_SET : GPIO_PIN_RESET);

    HAL_GPIO_WritePin(LCD_D5_PORT,
                      LCD_D5_PIN,
                      (data & 0x02) ? GPIO_PIN_SET : GPIO_PIN_RESET);

    HAL_GPIO_WritePin(LCD_D6_PORT,
                      LCD_D6_PIN,
                      (data & 0x04) ? GPIO_PIN_SET : GPIO_PIN_RESET);

    HAL_GPIO_WritePin(LCD_D7_PORT,
                      LCD_D7_PIN,
                      (data & 0x08) ? GPIO_PIN_SET : GPIO_PIN_RESET);


    /* Tao xung Enable */
    /* Đặt E lên 1 rồi xuống 0 để LCD chốt 4 bit đang có trên D4..D7. */
    HAL_GPIO_WritePin(LCD_E_PORT,
                      LCD_E_PIN,
                      GPIO_PIN_SET);

    HAL_Delay(1);

    /* Cạnh xuống của E kết thúc lần gửi; delay cho LCD xử lý trước lần kế tiếp. */
    HAL_GPIO_WritePin(LCD_E_PORT,
                      LCD_E_PIN,
                      GPIO_PIN_RESET);

    HAL_Delay(1);
}


/*
 * GUI LENH LCD */
void LCD_SendCommand(uint8_t cmd)
{
    /* RS = 0 -> command */
    /* RS thấp báo cho LCD rằng byte sắp gửi là lệnh điều khiển. */
    HAL_GPIO_WritePin(LCD_RS_PORT,
                      LCD_RS_PIN,
                      GPIO_PIN_RESET);

    /* 4 bit cao */
    /* Ví dụ cmd = 0x28: gửi 0x2 trước, rồi 0x8 sau. */
    LCD_Send4Bits(cmd >> 4);

    /* 4 bit thap */
    /* 0x0F giữ lại 4 bit thấp và bỏ 4 bit cao của cmd. */
    LCD_Send4Bits(cmd & 0x0F);

    /* Chờ LCD hoàn tất xử lý lệnh trước khi gửi byte tiếp theo. */
    HAL_Delay(2);
}


/*
 * GUI DU LIEU LCD */
void LCD_SendData(uint8_t data)
{
    /* RS = 1 -> data */
    /* RS cao báo rằng byte này là mã ký tự cần hiển thị, không phải lệnh. */
    HAL_GPIO_WritePin(LCD_RS_PORT,
                      LCD_RS_PIN,
                      GPIO_PIN_SET);

    /* 4 bit cao */
    /* Một ký tự 8 bit được chia thành hai lần truyền 4 bit. */
    LCD_Send4Bits(data >> 4);

    /* 4 bit thap */
    LCD_Send4Bits(data & 0x0F);

    HAL_Delay(1);
}


/*
 * GUI CHUOI*/
void LCD_SendString(char *str)
{
    /* *str là ký tự hiện tại; vòng lặp dừng ở byte '\0' cuối chuỗi C. */
    while (*str)
    {
        /* Gửi từng ký tự; LCD tự chuyển con trỏ sang cột kế tiếp. */
        LCD_SendData((uint8_t)(*str));

        /* Tăng con trỏ trong RAM để đọc ký tự tiếp theo của chuỗi. */
        str++;
    }
}


/*
 * DAT CON TRO LCD
 *
 * row = 0 -> dong 1
 * row = 1 -> dong 2*/
void LCD_SetCursor(uint8_t row, uint8_t col)
{
    /* Lệnh đặt địa chỉ DDRAM có bit 7 bằng 1; dòng 1 bắt đầu ở 0x80. */
    if (row == 0)
    {
        LCD_SendCommand(0x80 + col);
    }
    else
    {
        /* Trên LCD 16x2, địa chỉ bắt đầu của dòng 2 là 0xC0. */
        LCD_SendCommand(0xC0 + col);
    }
}


/* 
 * KHOI TAO LCD 16X2 - 4 BIT*/
void LCD_Init(void)
{
    /* Đợi LCD ổn định nguồn trước khi gửi chuỗi khởi tạo. */
    HAL_Delay(50);

    /* RS = 0 */
    HAL_GPIO_WritePin(LCD_RS_PORT,
                      LCD_RS_PIN,
                      GPIO_PIN_RESET);

    /* E = 0 */
    HAL_GPIO_WritePin(LCD_E_PORT,
                      LCD_E_PIN,
                      GPIO_PIN_RESET);


    /*
     * Khoi tao LCD ve che do 4-bit
     */

    LCD_Send4Bits(0x03);
    HAL_Delay(5);

    /* Gửi 0x03 ba lần để LCD về trạng thái khởi tạo theo giao thức chuẩn. */
    LCD_Send4Bits(0x03);
    HAL_Delay(5);

    LCD_Send4Bits(0x03);
    HAL_Delay(1);

    /* Nibble 0x02 chuyển LCD sang giao tiếp 4 bit. */
    LCD_Send4Bits(0x02);
    HAL_Delay(1);


    /* 4 bit, 2 dong, font 5x8 */
    /* 0x28 = function set: truyền 4 bit, hiển thị 2 dòng, font 5x8. */
    LCD_SendCommand(0x28);

    /* Bat man hinh, tat con tro */
    /* 0x0C bật hiển thị; tắt con trỏ và tắt nhấp nháy. */
    LCD_SendCommand(0x0C);

    /* Tu dong tang con tro */
    /* 0x06 tăng vị trí ghi sau mỗi ký tự, không dịch toàn bộ màn hình. */
    LCD_SendCommand(0x06);

    /* Xoa LCD */
    /* 0x01 xóa ký tự và đưa con trỏ về đầu; cần thêm thời gian xử lý. */
    LCD_SendCommand(0x01);

    HAL_Delay(5);
}


/* USER CODE END 0 */


/**
  * @brief  The application entry point.
  * @retval int
  */
int main(void)
{
    /* Khởi tạo HAL và SysTick để các hàm HAL_Delay() hoạt động. */
    HAL_Init();

    /* Chọn nguồn xung và tốc độ chạy cho CPU, bus và ADC. */
    SystemClock_Config();

    /* Cấu hình các chân LED/LCD, ADC đọc LDR, rồi USART1 của dự án. */
    MX_GPIO_Init();
    MX_ADC1_Init();
    MX_USART1_UART_Init();


    /* USER CODE BEGIN 2 */

    /* Hieu chinh ADC */
    /* Hiệu chỉnh ADC trước lần đo đầu tiên để giảm sai lệch nội bộ. */
    HAL_ADCEx_Calibration_Start(&hadc1);


    /* Khoi tao LCD */
    /* Thiết lập LCD 16x2 để có thể dùng các hàm ghi lệnh và ghi chuỗi. */
    LCD_Init();


    /* Hien thi khi khoi dong */
    /* Hai lời chào chỉ xuất hiện một lần ở đầu chương trình. */
    LCD_SetCursor(0, 0);
    LCD_SendString("LDR SYSTEM");

    LCD_SetCursor(1, 0);
    LCD_SendString("Starting...");

    HAL_Delay(1000);

    /* Xóa lời chào, chuẩn bị vùng hiển thị kết quả đo. */
    LCD_SendCommand(0x01);

    /* USER CODE END 2 */


    /* Infinite loop */
    /* USER CODE BEGIN WHILE */

    while (1)
    {
        /* Mỗi lượt: đo ánh sáng -> quyết định LED -> cập nhật hai dòng LCD. */
        /* USER CODE END WHILE */

        /* USER CODE BEGIN 3 */


        /* 
         * 1. DOC ADC TU LDR
         * PA1 = ADC1_IN1 */

        /* Khởi động một phép chuyển đổi ADC vì chế độ liên tục đang tắt. */
        HAL_ADC_Start(&hadc1);


        /* Chờ tối đa 100 ms; nếu thành công mới lấy mẫu vừa chuyển đổi. */
        /* Nếu timeout, adc_value vẫn giữ mẫu của lượt trước. */
        if (HAL_ADC_PollForConversion(&hadc1, 100) == HAL_OK)
        {
            /* Với ADC 12 bit, giá trị số thường nằm trong khoảng 0..4095. */
            adc_value =
                HAL_ADC_GetValue(&hadc1);
        }


        /* Kết thúc lượt đo để vòng sau có thể bắt đầu phép đo mới. */
        HAL_ADC_Stop(&hadc1);



        /* 
         * 2. DIEU KHIEN LED
         *
         * PA2 -> R220 -> LED -> GND
         *
         * SET   = ON
         * RESET = OFF */

        /* Code giả định tối làm adc_value tăng; chiều này phụ thuộc cách mắc LDR. */
        /* Ngưỡng 2000 chia kết quả thành 2 trạng thái ON/OFF của Bài 1. */
        if (adc_value >= LDR_THRESHOLD)
        {
            /* Toi -> bat LED */
            /* PA2 mức cao: dòng đi từ PA2 qua điện trở, LED rồi về GND. */
            HAL_GPIO_WritePin(GPIOA,
                              GPIO_PIN_2,
                              GPIO_PIN_SET);


            /* Tạo sẵn nội dung dòng 2; khoảng trắng xóa chữ cũ còn trên LCD. */
            snprintf(lcd_line2,
                     sizeof(lcd_line2),
                     "LED: ON        ");
        }
        else
        {
            /* Sang -> tat LED */
            /* PA2 mức thấp nên LED không có hiệu điện thế để sáng. */
            HAL_GPIO_WritePin(GPIOA,
                              GPIO_PIN_2,
                              GPIO_PIN_RESET);


            /* Dòng chữ trên LCD phản ánh cùng quyết định đang áp dụng cho LED. */
            snprintf(lcd_line2,
                     sizeof(lcd_line2),
                     "LED: OFF       ");
        }



        /* 
         * 3. TAO NOI DUNG LCD */

        /* snprintf giới hạn số byte ghi vào bộ đệm để tránh tràn mảng. */
        /* %-10lu in số thập phân căn trái trong 10 ô; cast khớp với %lu. */
        /* Đây là số ADC thô, chưa được quy đổi ra điện áp hay độ rọi lux. */
        snprintf(lcd_line1,
                 sizeof(lcd_line1),
                 "ADC: %-10lu",
                 (unsigned long)adc_value);



        /* 
         * 4. HIEN THI LCD */

        /* Đặt con trỏ ở cột 0 dòng 1 rồi in chuỗi giá trị ADC. */
        LCD_SetCursor(0, 0);

        LCD_SendString(lcd_line1);


        /* Đặt con trỏ ở cột 0 dòng 2 rồi in trạng thái LED. */
        LCD_SetCursor(1, 0);

        LCD_SendString(lcd_line2);



        /* Tạm dừng trước lần đo tiếp theo; LCD còn có delay trong lúc gửi. */
        HAL_Delay(300);


        /* USER CODE END 3 */
    }
}


/**
  * @brief System Clock Configuration
  * @retval None
  */
void SystemClock_Config(void)
{
    /* Khởi tạo các cấu trúc về 0 rồi lần lượt chọn dao động, bus và clock ADC. */
    RCC_OscInitTypeDef RCC_OscInitStruct = {0};
    RCC_ClkInitTypeDef RCC_ClkInitStruct = {0};
    RCC_PeriphCLKInitTypeDef PeriphClkInit = {0};


    /* HSI 8 MHz */
    /* Dùng dao động RC nội HSI 8 MHz; không cần thạch anh ngoài trong mạch này. */
    RCC_OscInitStruct.OscillatorType =
        RCC_OSCILLATORTYPE_HSI;

    RCC_OscInitStruct.HSIState =
        RCC_HSI_ON;

    RCC_OscInitStruct.HSICalibrationValue =
        RCC_HSICALIBRATION_DEFAULT;

    /* Không nhân tần số bằng PLL: clock hệ thống lấy trực tiếp từ HSI. */
    RCC_OscInitStruct.PLL.PLLState =
        RCC_PLL_NONE;


    /* Nếu không cấu hình được nguồn dao động, dừng trong Error_Handler(). */
    if (HAL_RCC_OscConfig(&RCC_OscInitStruct) != HAL_OK)
    {
        Error_Handler();
    }


    /* Chọn các nhóm clock mà HAL_RCC_ClockConfig() sẽ thiết lập. */
    RCC_ClkInitStruct.ClockType =
        RCC_CLOCKTYPE_HCLK |
        RCC_CLOCKTYPE_SYSCLK |
        RCC_CLOCKTYPE_PCLK1 |
        RCC_CLOCKTYPE_PCLK2;


    /* SYSCLK lấy từ HSI; AHB, APB1 và APB2 đều không bị chia thêm. */
    RCC_ClkInitStruct.SYSCLKSource =
        RCC_SYSCLKSOURCE_HSI;

    RCC_ClkInitStruct.AHBCLKDivider =
        RCC_SYSCLK_DIV1;

    RCC_ClkInitStruct.APB1CLKDivider =
        RCC_HCLK_DIV1;

    RCC_ClkInitStruct.APB2CLKDivider =
        RCC_HCLK_DIV1;


    /* FLASH_LATENCY_0 phù hợp với cấu hình clock thấp đang dùng. */
    if (HAL_RCC_ClockConfig(&RCC_ClkInitStruct,
                            FLASH_LATENCY_0) != HAL_OK)
    {
        Error_Handler();
    }


    /* ADC clock */
    /* ADC dùng clock APB2 chia 2, tức khoảng 4 MHz nếu PCLK2 là 8 MHz. */
    PeriphClkInit.PeriphClockSelection =
        RCC_PERIPHCLK_ADC;

    PeriphClkInit.AdcClockSelection =
        RCC_ADCPCLK2_DIV2;


    if (HAL_RCCEx_PeriphCLKConfig(&PeriphClkInit) != HAL_OK)
    {
        Error_Handler();
    }
}


/**
  * @brief ADC1 Initialization Function
  * @retval None
  */
static void MX_ADC1_Init(void)
{
    /* sConfig mô tả kênh đo và thời gian lấy mẫu của ADC1. */
    ADC_ChannelConfTypeDef sConfig = {0};


    /* Dùng bộ ADC1; chỉ đo một kênh nên không cần quét nhiều kênh. */
    hadc1.Instance =
        ADC1;

    hadc1.Init.ScanConvMode =
        ADC_SCAN_DISABLE;

    hadc1.Init.ContinuousConvMode =
        DISABLE;

    /* Không chia chuỗi chuyển đổi thành các nhóm nhỏ. */
    hadc1.Init.DiscontinuousConvMode =
        DISABLE;

    /* Mỗi lượt đo được kích bằng HAL_ADC_Start(), không bởi chân/timer ngoài. */
    hadc1.Init.ExternalTrigConv =
        ADC_SOFTWARE_START;

    /* Kết quả căn phải; chỉ có một lần chuyển đổi trong chuỗi regular. */
    hadc1.Init.DataAlign =
        ADC_DATAALIGN_RIGHT;

    hadc1.Init.NbrOfConversion =
        1;


    /* HAL thiết lập ADC1 theo các thông số đã gán ở trên. */
    if (HAL_ADC_Init(&hadc1) != HAL_OK)
    {
        Error_Handler();
    }


    /* PA1 = ADC1_IN1 */
    /* Chọn kênh 1 nối với PA1 làm đầu vào điện áp của mạch chia áp LDR. */
    sConfig.Channel =
        ADC_CHANNEL_1;

    /* Rank 1: đây là mẫu đầu tiên và duy nhất trong chuỗi đo regular. */
    sConfig.Rank =
        ADC_REGULAR_RANK_1;

    /* Lấy mẫu trong 55,5 chu kỳ ADC trước khi chuyển đổi. */
    sConfig.SamplingTime =
        ADC_SAMPLETIME_55CYCLES_5;


    /* Gắn cấu hình kênh 1 vào hadc1; lỗi khởi tạo sẽ dừng chương trình. */
    if (HAL_ADC_ConfigChannel(&hadc1,
                              &sConfig) != HAL_OK)
    {
        Error_Handler();
    }
}


/**
  * @brief USART1 Initialization Function
  * @retval None
  *
  * UART khong bat buoc cho bai nay.
  * Giu lai vi project hien tai dang co USART1.
  */
static void MX_USART1_UART_Init(void)
{
    /* UART1 được tạo sẵn trong dự án, không tham gia đọc LDR hay ghi LCD. */
    huart1.Instance =
        USART1;

    /* 115200 baud, 8 bit dữ liệu, 1 stop bit, không parity (8N1). */
    huart1.Init.BaudRate =
        115200;

    huart1.Init.WordLength =
        UART_WORDLENGTH_8B;

    huart1.Init.StopBits =
        UART_STOPBITS_1;

    huart1.Init.Parity =
        UART_PARITY_NONE;

    /* Cho phép cả truyền và nhận; không dùng điều khiển luồng phần cứng. */
    huart1.Init.Mode =
        UART_MODE_TX_RX;

    huart1.Init.HwFlowCtl =
        UART_HWCONTROL_NONE;

    /* Lấy mẫu 16 lần trên mỗi bit để UART xác định mức logic. */
    huart1.Init.OverSampling =
        UART_OVERSAMPLING_16;


    if (HAL_UART_Init(&huart1) != HAL_OK)
    {
        Error_Handler();
    }
}


/**
  * @brief GPIO Initialization Function
  * @retval None
  */
static void MX_GPIO_Init(void)
{
    /* Cấu trúc tạm mô tả chân, hướng, điện trở kéo và tốc độ GPIO. */
    GPIO_InitTypeDef GPIO_InitStruct = {0};


    /* GPIO clocks */
    /* Phải cấp clock cho cổng trước khi cấu hình/ghi chân của cổng đó. */
    /* GPIOD được bật bởi cấu hình dự án, dù phần code này không dùng chân PD. */
    __HAL_RCC_GPIOD_CLK_ENABLE();
    __HAL_RCC_GPIOA_CLK_ENABLE();
    __HAL_RCC_GPIOB_CLK_ENABLE();



    /* =====================================================
     * PA2 = LED
     *
     * PA2 -> R220 -> LED -> GND
     *
     * RESET = OFF
     * SET   = ON
     * ===================================================== */

    /* Nạp trước mức 0 để LED tắt ngay khi PA2 chuyển sang chế độ ngõ ra. */
    HAL_GPIO_WritePin(GPIOA,
                      GPIO_PIN_2,
                      GPIO_PIN_RESET);


    /* Chỉ định PA2 là chân cần cấu hình trong lần gọi HAL_GPIO_Init này. */
    GPIO_InitStruct.Pin =
        GPIO_PIN_2;

    /* Push-pull cho phép chân xuất cả mức cao và mức thấp chủ động. */
    GPIO_InitStruct.Mode =
        GPIO_MODE_OUTPUT_PP;

    /* Không dùng điện trở kéo nội; tốc độ LOW đã đủ cho LED bật/tắt chậm. */
    GPIO_InitStruct.Pull =
        GPIO_NOPULL;

    GPIO_InitStruct.Speed =
        GPIO_SPEED_FREQ_LOW;


    /* Áp dụng cấu hình vừa gán cho cổng GPIOA. */
    HAL_GPIO_Init(GPIOA,
                  &GPIO_InitStruct);



    /* 
     * LCD
     *
     * PB1  = RS
     * PB10 = E
     * PB11 = D4
     * PB12 = D5
     * PB13 = D6
     * PB14 = D7 */

    /* Đưa toàn bộ chân điều khiển LCD về mức thấp trước khi đổi sang ngõ ra. */
    HAL_GPIO_WritePin(GPIOB,
                      GPIO_PIN_1 |
                      GPIO_PIN_10 |
                      GPIO_PIN_11 |
                      GPIO_PIN_12 |
                      GPIO_PIN_13 |
                      GPIO_PIN_14,
                      GPIO_PIN_RESET);


    /* Gộp các chân LCD bằng toán tử OR để cấu hình chúng trong một lần gọi. */
    GPIO_InitStruct.Pin =
        GPIO_PIN_1 |
        GPIO_PIN_10 |
        GPIO_PIN_11 |
        GPIO_PIN_12 |
        GPIO_PIN_13 |
        GPIO_PIN_14;


    /* LCD cần các chân đầu ra push-pull, không cần điện trở kéo nội. */
    GPIO_InitStruct.Mode =
        GPIO_MODE_OUTPUT_PP;

    GPIO_InitStruct.Pull =
        GPIO_NOPULL;

    GPIO_InitStruct.Speed =
        GPIO_SPEED_FREQ_LOW;


    /* Áp dụng cấu hình cho các chân PB đã chọn ở trên. */
    HAL_GPIO_Init(GPIOB,
                  &GPIO_InitStruct);



    /* 
     * PA1 = ADC INPUT */

    /* PA1 là đầu vào analog: tắt mạch vào số để ADC nhận điện áp cảm biến. */
    GPIO_InitStruct.Pin =
        GPIO_PIN_1;

    GPIO_InitStruct.Mode =
        GPIO_MODE_ANALOG;

    /* Không kéo lên/kéo xuống vì điện áp do mạch chia áp LDR quyết định. */
    GPIO_InitStruct.Pull =
        GPIO_NOPULL;


    HAL_GPIO_Init(GPIOA,
                  &GPIO_InitStruct);
}


/**
  * @brief Error Handler
  */
void Error_Handler(void)
{
    /* Tắt ngắt và đứng mãi ở đây nếu một bước khởi tạo HAL trả về lỗi. */
    __disable_irq();

    while (1)
    {
    }
}


#ifdef USE_FULL_ASSERT

void assert_failed(uint8_t *file,
                   uint32_t line)
{
    /* Hàm này chỉ được biên dịch khi bật USE_FULL_ASSERT; hiện chưa xử lý lỗi. */
}

#endif
