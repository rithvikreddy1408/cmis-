#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN D2
#define RST_PIN D1

const char* ssid = "Teena";
const char* password = "teena021";

// Admin dashboard -> RFID -> Devices -> Provision Device (key shown once).
const char* API_BASE = "http://10.208.249.125:4100/api/v1";
const char* DEVICE_ID = "2jhNakRW6dcgxeRc5HRN";
const char* DEVICE_KEY = "R7iVp_xq6I2Pk0sCuXayp_AimJm-87i-";

MFRC522 rfid(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("========== CMIS RFID ==========");

  // SPI and RFID
  SPI.begin();               // SCK=D5, MISO=D6, MOSI=D7
  rfid.PCD_Init();
  delay(100);

  // Check RFID Reader
  byte version = rfid.PCD_ReadRegister(MFRC522::VersionReg);

  Serial.print("RC522 Version: 0x");
  Serial.println(version, HEX);

  if (version == 0x00 || version == 0xFF) {
    Serial.println("ERROR: RC522 NOT DETECTED!");
    Serial.println("Check your wiring.");
  } else {
    Serial.println("RC522 Connected Successfully!");
  }

  // Connect WiFi
  Serial.print("Connecting to WiFi");

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  Serial.println();
  Serial.println("Tap RFID Card...");
}

void sendTap(const String& rfidUID) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, skipping tap");
    return;
  }

  WiFiClient client;
  HTTPClient http;
  http.begin(client, String(API_BASE) + "/rfid/tap");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("X-Device-Key", DEVICE_KEY);

  String payload = "{\"rfidUID\":\"" + rfidUID + "\"}";
  int status = http.POST(payload);

  Serial.print("HTTP ");
  Serial.println(status);
  Serial.println(http.getString());

  http.end();
}

void loop() {

  // Wait for card
  if (!rfid.PICC_IsNewCardPresent()) {
    delay(100);
    return;
  }

  Serial.println("Card Detected!");

  // Read card
  if (!rfid.PICC_ReadCardSerial()) {
    Serial.println("Card Read Failed!");
    delay(500);
    return;
  }

  Serial.print("Card UID: ");

  String uid = "";

  for (byte i = 0; i < rfid.uid.size; i++) {

    if (rfid.uid.uidByte[i] < 0x10) {
      Serial.print("0");
      uid += "0";
    }

    Serial.print(rfid.uid.uidByte[i], HEX);
    Serial.print(" ");

    uid += String(rfid.uid.uidByte[i], HEX);
  }

  uid.toUpperCase();

  Serial.println();
  Serial.print("UID String: ");
  Serial.println(uid);

  Serial.println("-------------------------");

  sendTap(uid);

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  delay(1000);
}
