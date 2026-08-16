// helper to send notification over BLE UART
// ==========================================
// BLE NOTIFICATION
// ==========================================

function sendNotification(_type: string, detail: string) {
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

// ==========================================
// BUZZER
// ==========================================

function startBuzzer() {
    pins.digitalWritePin(buzzerPin, 1)
}

function stopBuzzer() {
    pins.digitalWritePin(buzzerPin, 0)
}

// ==========================================
// STOP CURRENT ALARM
// ==========================================

function stopAlarm() {
    alarmActive = false

    stopBuzzer()

    basic.clearScreen()
}

// ==========================================
// END COMPLETE EVENT
// ==========================================

function endEvent() {
    alarmActive = false
    eventActive = false
    alarmCount = 0

    isLightDown = false
    isMotionDetected = false

    stopBuzzer()
    basic.clearScreen()
    basic.showIcon(IconNames.Happy)
}

// ==========================================
// START ONE ALARM
// ==========================================

function startAlarm() {

    alarmActive = true

    // Increase alarm counter
    alarmCount += 1

    // Send BLE notification ONLY when an alarm actually starts
    if (useBle) {

        if (isLightDown) {
            sendNotification("LIGHT", "LOW")
        }

        if (isMotionDetected) {
            sendNotification("MOTION", "DETECTED")
        }

        sendNotification("ALARM", `${alarmCount}`)
    }

    basic.showIcon(IconNames.Sad)

    startBuzzer()

    flashAlarmLeds(ALARM_DURATION_MS)
}

// ==========================================
// LED + ALARM TIMER
// ==========================================

function flashAlarmLeds(durationMs: number) {

    let alarmStart = input.runningTime()

    control.inBackground(() => {

        while (
            alarmActive &&
            input.runningTime() - alarmStart < durationMs
        ) {

            // LED ON
            basic.showLeds(`
                # # # # #
                # . . . #
                # . # . #
                # . . . #
                # # # # #
            `)

            basic.pause(200)


            // LED OFF
            basic.clearScreen()

            basic.pause(200)


            // Manual stop
            if (input.buttonIsPressed(Button.A)) {
                endEvent()
                return
            }
        }


        // Alarm duration finished
        if (alarmActive) {
            stopAlarm()
        }


        // ------------------------------------------
        // Alarm finished
        // Decide whether another alarm is required
        // ------------------------------------------

        if (eventActive && alarmCount < MAX_ALARMS_PER_EVENT) {

            // Wait before next alarm
            basic.pause(ALARM_GAP_MS)

            // Check Button A again
            if (input.buttonIsPressed(Button.A)) {
                endEvent()
                return
            }

            // Start next alarm
            startAlarm()

        } else {

            // Maximum alarms reached
            // Lock this event until sensor resets
            if (eventActive) {
                basic.showIcon(IconNames.No)
            }
        }
    })
}

// ==========================================
// VARIABLES
// ==========================================

let lastTrigger = 0
let now = 0

let motion = 0
let previousMotion = 0

let lightVal = 0

let isMotionDetected = false
let isLightDown = false

let useBle = false
let buzzerPin = DigitalPin.P8

let BLE_QUEUE_MAX = 20

let ALARM_DURATION_MS = 5000
let ALARM_GAP_MS = 2000

let MAX_ALARMS_PER_EVENT = 3

let DEBOUNCE_MS = 2000

let bleQueue: string[] = []
let bleConnected = false

let alarmActive = false

let eventActive = false
let alarmCount = 0

let pirVal = 0

let LIGHT_THRESHOLD = 400


// ==========================================
// CONFIGURATION
// ==========================================

ALARM_DURATION_MS = 5000
MAX_ALARMS_PER_EVENT = 3

// Gap between alarm #1, #2 and #3
ALARM_GAP_MS = 2000

BLE_QUEUE_MAX = 20

DEBOUNCE_MS = 2000

buzzerPin = DigitalPin.P8

useBle = true

// ==========================================
// STARTUP
// ==========================================

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
// ==========================================
// MAIN SENSOR LOOP
// ==========================================

basic.forever(function () {

    lightVal = pins.analogReadPin(AnalogPin.P0)

    motion = pins.digitalReadPin(DigitalPin.P2)

    now = input.runningTime()


    // Current sensor state
    isLightDown = lightVal < LIGHT_THRESHOLD

    isMotionDetected = motion == 1


    // ==================================================
    // MOTION EVENT DETECTION
    //
    // LOW -> HIGH = NEW EVENT
    //
    // HIGH -> HIGH = SAME EVENT
    //
    // HIGH -> LOW = EVENT FINISHED
    // ==================================================

    if (motion == 1 && previousMotion == 0) {

        // New motion event
        if (!eventActive) {

            eventActive = true

            alarmCount = 0

            lastTrigger = now

            startAlarm()
        }
    }


    // ==================================================
    // MOTION EVENT FINISHED
    //
    // HIGH -> LOW
    // ==================================================

    if (motion == 0 && previousMotion == 1) {

        // Motion has ended.
        //
        // We don't immediately start another event.
        // The next LOW -> HIGH will create a new event.

        if (!alarmActive) {

            eventActive = false

            alarmCount = 0
        }
    }


    // Remember current PIR state
    previousMotion = motion


    // ==================================================
    // LIGHT EVENT
    // ==================================================

    if (
        isLightDown &&
        !eventActive &&
        !alarmActive &&
        now - lastTrigger > DEBOUNCE_MS
    ) {

        eventActive = true

        alarmCount = 0

        lastTrigger = now

        startAlarm()
    }


    // ==================================================
    // BUTTON A
    // ==================================================

    if (alarmActive && input.buttonIsPressed(Button.A)) {

        endEvent()
    }


    basic.pause(100)
})