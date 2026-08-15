// helper to send notification over BLE UART
function sendNotification (_type: string, detail: string) {
    const msg = `${_type}:${detail}\n`
if (bleConnected) {
        bluetooth.uartWriteString(msg)
        return
    }
    if (bleQueue.length >= BLE_QUEUE_MAX) {
        bleQueue.shift()
    }
    bleQueue.push(msg)
    basic.showIcon(IconNames.Asleep)
    control.inBackground(() => {
        basic.pause(300)
        basic.showIcon(IconNames.Happy)
    })
}
function startBuzzer () {
    pins.digitalWritePin(buzzerPin, 1)
}
function stopBuzzer () {
    pins.digitalWritePin(buzzerPin, 0)
}
function stopAlarm () {
    alarmActive = false
    isLightDown = false
    isMotionDetected = false
    stopBuzzer()
    basic.clearScreen()
    basic.showIcon(IconNames.Happy)
}
function startAlarm () {
    alarmActive = true
    if (useBle) {
        if (isLightDown) {
            sendNotification("LIGHT", "LOW")
        }
        if (isMotionDetected) {
            sendNotification("MOTION", "DETECTED")
        }
    }
    basic.showIcon(IconNames.Sad)
    startBuzzer()
    flashAlarmLeds(ALARM_DURATION_MS)
}
/**
 * current light level
 */
function flashAlarmLeds (durationMs: number) {
    start = input.runningTime()
    control.inBackground(() => {
        while (alarmActive && input.runningTime() - start < durationMs) {
            // LED ON pattern
            basic.showLeds(`
            # # # # #
            # . . . #
            # . # . #
            # . . . #
            # # # # #
        `)
            basic.pause(200)

            // LED OFF (blink gap)
            basic.clearScreen()
            basic.pause(200)

            // Allow manual reset mid-alarm
            if (input.buttonIsPressed(Button.A)) {
                stopAlarm()
                break
            }
        }
        // Automatically stop alarm when duration finishes
        if (alarmActive) stopAlarm()              // <-- stops alarm after duration
    })
}
let lastTrigger = 0
let now = 0
let motion = 0
let lightVal = 0
let isMotionDetected = false
let isLightDown = false
let useBle = false
let buzzerPin = 0
let BLE_QUEUE_MAX = 0
let ALARM_DURATION_MS = 0
let start = 0
let bleQueue: string[] = []
let bleConnected = false
let alarmActive = false
let pirVal = 0
ALARM_DURATION_MS = 3000
let LIGHT_THRESHOLD = 400
BLE_QUEUE_MAX = 20
let DEBOUNCE_MS = 2000
buzzerPin = DigitalPin.P8
useBle = true
basic.showIcon(IconNames.Happy)
basic.pause(2000)
if (useBle) {
    bluetooth.startUartService()
    basic.showString("BLE")
    bluetooth.onBluetoothConnected(function () {
        bleConnected = true
        basic.showIcon(IconNames.Heart)
        bluetooth.uartWriteString('STATUS:GREEN')
        // flush queue
        while (bleQueue.length && bleConnected) {
            const m = bleQueue.shift()
            if (m) bluetooth.uartWriteString(m)
            basic.pause(50)
        }
    })
bluetooth.onBluetoothDisconnected(function () {
        bleConnected = false
        basic.showIcon(IconNames.Sad)
    })
}
basic.forever(function () {
    lightVal = pins.analogReadPin(AnalogPin.P0)
    motion = pins.digitalReadPin(DigitalPin.P2)
    now = input.runningTime()
    isLightDown = lightVal < LIGHT_THRESHOLD
    isMotionDetected = motion == 1
    if ((isLightDown || isMotionDetected) && now - lastTrigger > DEBOUNCE_MS && !(alarmActive)) {
        lastTrigger = now
        startAlarm()
    }
    if (alarmActive && input.buttonIsPressed(Button.A)) {
        stopAlarm()
    }
    basic.pause(1000)
})
