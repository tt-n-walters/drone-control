const puppeter = require("puppeteer");
const events = require("events");

const { axes, buttons } = require("./mappings");

class FlightStick {
    constructor() {
        this.emitter = new events.EventEmitter();
        this.POLL_INTERVAL = 50;
        this.NOISE_THRESHOLD = 0.1;
        this.states = {};
        for (const input of Object.values(axes).concat(Object.values(buttons))) {
            this.states[input] = undefined;
        }
    }

    on(event, callback) {
        this.emitter.on(event, callback);
    }

    async init() {
        const browser = await puppeter.launch();
        const page = await browser.newPage();
        page.on("console", (msg) => {
            console.log("PAGE:", msg.text());
        });
        await page.exposeFunction("emitEvent", (event, msg) => {
            this.emitter.emit(event, JSON.stringify(msg));
        });
        await page.evaluate(
            ([axes, buttons, states, POLL_INTERVAL, NOISE_THRESHOLD]) => {
                const interval = {};
                window.addEventListener("gamepadconnected", (e) => {
                    const id = e.gamepad.index;
                    window.emitEvent("connect");
                    interval[id] = window.setInterval(() => {
                        const gamepad = navigator.getGamepads()[e.gamepad.index];

                        for (const index in axes) {
                            const mapping = axes[index];
                            const data = gamepad.axes[index];
                            if (Math.abs(data) > NOISE_THRESHOLD && data !== states[mapping]) {
                                if (states[mapping] !== undefined) {
                                    window.emitEvent(mapping, data);
                                }
                                states[mapping] = data;
                            }
                        }

                        for (const index in buttons) {
                            const mapping = buttons[index];
                            const button = gamepad.buttons[index];
                            if (states[mapping] !== button.pressed) {
                                if (states[mapping] !== undefined) {
                                    window.emitEvent(mapping, button.pressed);
                                }
                                states[mapping] = button.pressed;
                            }
                        }
                    }, POLL_INTERVAL);
                });
                window.addEventListener("gamepaddisconnected", (e) => {
                    const id = e.gamepad.index;
                    window.emitEvent("disconnect");
                    window.clearInterval(interval[id]);
                });
            },
            [axes, buttons, this.states, this.POLL_INTERVAL, this.NOISE_THRESHOLD]
        );
    }
}

module.exports = FlightStick;
