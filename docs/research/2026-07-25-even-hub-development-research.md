# Investigate Even Hub G2 and R1 App Development

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

- Confirmation date: 2026-07-25
- Target environment: Windows PC, iPhone, Even G2, Even R1, G2 charging dock
- Investigation scope: App structure, local and real-time device testing, SDK permissions, device data, AI and STT, R1 sensor, audio channel, WebView, distribution method, paid sales, screening, IMU, Korean community
- Reference materials: Even Realities developer portal and terms and conditions, support documentation, official GitHub repository, public npm packages, public app source and community posts

## Conclusion

You can develop an Even Hub app using only the equipment you currently have and test it on actual devices. The charging dock and USB cable do not install or debug apps. Run the web app on Windows. Then scan its development QR code with the Even Realities app on your iPhone. G2 and R1 operate as screen output and input devices when connected to the iPhone.

The official development method uses a TypeScript web app and Vite. The glasses do not display the entire web page. The app logic and mobile phone UI run in the iPhone's WebView. The Even Hub SDK bridge separately configures text, list, and image containers for the glasses.

The terms describe paid plugins and subscriptions. This investigation did not confirm a public Even Hub payment or settlement system. The reviewed documents specify no deadline for public app reviews. The IMU exposes only `x`, `y`, and `z`. The reviewed API documents specify no coordinate system, units, or accuracy. Measure these values on the actual device before use. This investigation found no official Korean community or publicly confirmed Korean Even Hub app development team. Currently, the official Discord, GitHub, and the community subreddit `r/EvenRealities` are the most practical communication channels.

There is no API in public SDK 0.0.12 to call Even AI, LLM, STT or TTS directly. Receive 16 kHz mono PCM from the G2 microphone. Send that audio to an external service or your own STT and AI backend. The R1 includes an IMU for activity tracking. The plugin API does not expose raw R1 IMU values, ring angle, or health data. The G2 delivers its four microphones as one mono stream without separate channel data. The public API therefore cannot support microphone-array sound-source direction estimation.

## Entire structure

```text
Windows PC
TypeScript and Vite Development Server
        |
        | Wi-Fi or HTTPS
        v
iPhone
Running app logic in WKWebView
Even Hub SDK Bridge
        |
        | Bluetooth
        v
G2 and R1
Screen output, gesture input, microphone, IMU
```

The role of each component is as follows.

| Components | Role |
| --- | --- |
| Windows PC | Write TypeScript code, run, build and package Vite development server |
| iPhone | Executing the app's WebView, network communication, permission handling, connection with G2 and R1 |
| G2 | 576 x 288 glasses screen, touch input, microphone, IMU |
| R1 | Press, double press, swipe up and down to enter |
| charging dock | For charging purposes only, not for transferring or debugging Even Hub apps |

## Type of app

The official starter template uses the following elements:

- HTML
- TypeScript
- Vite
- `@evenrealities/even_hub_sdk`
- `@evenrealities/evenhub-cli`
- `@evenrealities/evenhub-simulator`
- `app.json` containing app metadata

Vite is the default in the official templates, not a required framework. You can also use React or Vue. Build static web assets and call the SDK bridge correctly. For a first app, start with the official `minimal` template.

Plain HTML and CSS are not displayed on the glasses screen. Create SDK containers of the following types and send them to G2.

- Text container
- list container
- Image container

A general WebView UI can be configured on the phone screen. The glasses use 576 x 288 resolution and 4-bit grayscale. They do not accept arbitrary CSS layouts or fonts.

## Windows development environment

### Recommended supplies

- Node.js 18 or higher
- Git
- Latest Even Realities iOS app
- Even Hub developer account
- G2 and R1 paired with iPhone

### Get started with official templates

Run the following in PowerShell:

```powershell
git clone https://github.com/even-realities/evenhub-templates.git
Copy-Item -Recurse .\evenhub-templates\minimal .\my-g2-app
Set-Location .\my-g2-app

npm install
npm run dev
```

The official `minimal` template's Vite configuration uses `host: true` to allow connection from a LAN. The default port is 5173.

## Actual device test

### Tested on the same Wi-Fi

1. Connect your Windows PC and iPhone to the same Wi-Fi.
2. Make sure G2 and R1 are connected to the Even Realities app on iPhone.
3. Run `npm run dev` on Windows.
4. Check the LAN IPv4 address of your Windows PC with `ipconfig`.
5. Create a QR code for development using the address.
6. Open Developer Center in the Even Realities app on your iPhone and scan the QR code.
7. Run the plugin and check operation on G2 and R1.

If the PC address is `192.168.0.20`, use this command.

```powershell
npx evenhub qr --url http://192.168.0.20:5173
```

If it doesn't connect, try opening the same URL in iPhone Safari first.

```text
http://192.168.0.20:5173
```

If it doesn't open in Safari, check the following items.

- Check whether Node.js is allowed to access the private network in the Windows firewall.
- Allow local network permissions for the Even Realities app on iOS.
- Check that the AP isolation or client isolation function of the router is not turned on.
- Check that the Vite server is not bound only to `localhost`.

### Testing via Internet

For `evenhub qr --url`, you can also use a public HTTPS address accessible from the iPhone. A temporary host or secure tunnel lets the iPhone load your app outside the LAN.

G2 and R1 must remain within Bluetooth range of the connected iPhone. Even Hub development can be carried out without a cable, but it is not structured to connect directly to a distant G2 through the Internet.

### Charging dock

The charging dock is not required for Even Hub app development, installation, or debugging. The app code is provided on Windows and loaded by the Even Realities app on iPhone. The glasses and ring communicate with the app through the iPhone.

## Simulator testing

The official template includes a simulator that can run on Windows. Run the following commands in each of the two PowerShell windows:

```powershell
npm run dev
```

```powershell
npm run simulate
```

The items that can be checked in the simulator are as follows.

- Glasses screen layout
- Text, list, image containers
- Tap and double tap
- Swipe up and down
- Basic audio flow using computer microphone
- App console and network errors

The following items must be checked on actual hardware.

- Actual G2 text readability and brightness
- Actual IMU data
- R1, left temple, right temple input classification
- Battery, wearing, charging, case status changes
- Sense of scrolling list of firmware
- Image memory limitations

Use the simulator to check layout and app logic. Verify hardware behavior on the actual devices.

## `app.json` permissions

The official public release, confirmed on 2026-07-25, declares the following six permissions:

| Permission name | Scope | Key return data or constraints |
| --- | --- | --- |
| `network` | External HTTP and WebSocket communication | Allowed URLs must be declared in `whitelist` |
| `location` | iPhone Location Services | Latitude, longitude, accuracy, altitude, speed, direction, time |
| `g2-microphone` | G2 Microphone Array | PCM s16le, 16 kHz, mono |
| `phone-microphone` | iPhone Microphone | PCM s16le, 16 kHz, mono |
| `album` | iPhone Photo Album | One photo, file name, MIME type, size, base64 |
| `camera` | iPhone Camera | A photo taken and its associated metadata |

Permissions are written as an object array, not a string array. Each permission requires `desc`, a description to be displayed to the user.

```json
{
  "permissions": [
    {
      "name": "network",
      "desc": "Get weather information.",
      "whitelist": [
        "https://api.example.com"
      ]
    },
    {
      "name": "g2-microphone",
      "desc": "Recognizes voice commands."
    }
  ]
}
```

The `network` whitelist does not bypass CORS. The API server must also return a CORS header allowing WebView requests. The development-stage Vite proxy can be used for local testing, but does not work with packaged apps.

Variables such as `VITE_API_KEY` become part of the built JavaScript. Keep secret API keys on a backend. Use a restricted user token when the client requires credentials.

## Information available from SDK

### Microphone

In `audioControl`, you can choose between the G2 microphone and the iPhone microphone.

- G2 Microphone: `AudioInputSource.Glasses`
- iPhone microphone: `AudioInputSource.Phone`
- Format: signed 16-bit little-endian PCM
- Sample rate: 16 kHz
- Channel: mono

Before using the G2 microphone, create a glasses-side start-page container. The SDK delivers audio through `audioEvent.audioPcm` in `onEvenHubEvent`. A separate STT service or local model must produce recognition results.

### Location

Location information comes from the iPhone's location services, not the G2. The SDK supports one-time queries and continuous updates.

- `latitude`
- `longitude`
- `accuracy`
- `altitude`
- `speed`
- `heading`
- `timestamp`

### IMU

You can start or stop reporting the G2's IMU with `imuControl`. The public SDK passes three values: `x`, `y`, and `z`.

The public types do not clearly define the following items.

- Physical units of each axis
- Axis direction, sign, origin and whether right- or left-handed coordinate system
- Separation method of accelerometer and gyroscope values
- quaternion
- Timestamp per sample
- Measurement range, resolution, bias, noise, drift and accuracy

The official document describes the values ​​from `ImuReportPace.P100` to `P1000` as protocol pacing codes. Do not interpret these codes as 100 Hz or 100 ms. The event has no sensor timestamp. Record arrival intervals in the app with `performance.now()` or `Date.now()`.

Before implementing posture estimation or gesture recognition, measure the values and their ranges on hardware. The reviewed `app.json` permission list has no separate IMU permission. Use a physical G2 to check the coordinate system. Simulator IMU data cannot replace sensor measurements.

### Further investigation of IMU coordinate system and accuracy

#### Officially confirmed scope

The G2 hardware introduction states that a geomagnetic sensor has been added to the IMU. The public Even Hub SDK does not define the meaning of `x`, `y`, or `z`. Possible interpretations include raw compass values, acceleration, angular velocity, and fused attitude. A hardware sensor does not imply that the plugin API exposes its data.

Currently, official data alone cannot answer the following questions:

- When the glasses are worn facing forward, which direction is each axis: forward, right, or upward?
- Are the units of the value `g`, `m/s²`, `deg/s`, `rad/s`, or a normalized dimensionless value?
- Whether it receives the gravity vector at rest, or the rotational speed or fused direction
- Factory calibrated and device to device variations
- Static and dynamic accuracy, repeatability, delay and sample drop rate

Therefore, there is currently no basis to create an official coordinate system table or provide numerical accuracy.

#### Heuristics confirmed in public implementations

Open app sources show real-world usability, but are not manufacturer specifications.

| public project | How IMUs are used | Things to keep in mind when interpreting |
| --- | --- | --- |
| `level-even-g2` | We empirically estimate the left and right directions of the glasses as the outer product of two gravity samples obtained when nodding on one G2, and use the unit vector in the device coordinate system to be approximately `(0.46, 0.88, 0.15)` | This shows the possibility that the sensor may have been placed at an angle to the head coordinate system within the temple of the glasses, but the values ​​were obtained from a single device.
| `even-g2-posture` | `x` is smoothed with an exponential moving average, and if it falls below the default threshold `-0.22`, it is judged to be slouching | It uses `x` as a de facto bow indicator, but does not insist on units or absolute angles |
| `eyefit-g2` | If the difference between the maximum and minimum values ​​for each axis in the last 1 second is more than `0.3`, it is determined that there has been a head rotation | A comment maps vertical movement to `x` and horizontal movement to `y`. The check passes when any of the three axes moves |
| `pickleball-even-g2` | Secondary check for audio-detected hits if `sqrt(x²+y²+z²)` exceeds the empirical threshold `2.5` | Code comments call it `g-force`, but it is an empirically tuned value without formal unit confirmation |

The `0.1°` on-screen tolerance in `level-even-g2` is a display threshold. It does not establish measurement accuracy. Measure thresholds on the user's G2 before using them in a new app.

#### How to check coordinate system and quality in real G2

1. Record `x`, `y`, `z` and reception time for more than 60 seconds on each of `P100`, `P500`, and `P1000`.
2. With the glasses at rest on a horizontal table, find the average, standard deviation, minimum and maximum values ​​for each axis.
3. After wearing glasses, perform the front view, head bow and tilt, left and right rotation, and left and right tilt separately.
4. Record the range of axes, signs, and values ​​that change significantly in each operation and the return to original position error.
5. Repeat each movement at least 5 times. Separate movement repeatability from sensor noise.
6. Rerun the app or reconnect the glasses and check whether the zero point and axis response are maintained.
7. Check the actual delivery speed for each pacing code by calculating the median, 95th percentile, and missing section of the reception interval.

This experiment measures end-to-end behavior for the tested G2, firmware, and iPhone environment. Although it does not provide the absolute accuracy guaranteed by the manufacturer, it is more useful for determining gesture thresholds and smoothing coefficients.

#### Possible use cases

- Simple confirmation and cancellation gestures using head nod and left/right shake
- Notification when slouched posture continues for a certain period of time
- A level or simple dashboard that responds to head tilt
- Assisted judgment of events such as racket hitting and running impact that combines audio and movement
- Guided gaze rest or exercise to check for head movement
- Relative scrolling or menu selection after the user corrects the frontal posture

The public APIs do not establish suitability for absolute orientation, precision navigation, medical diagnosis, or collision detection. The reviewed terms restrict publication of health and medical plugins. Before publishing a posture or exercise app, check whether its functions and claims meet the review rules.

### G2 and R1 inputs

The G2 touchpad and R1 provide the same basic gestures.

- press
- Double press
- Swipe up
- Swipe down

The input source can be distinguished by the `eventSource` of the system event.

| value | input source |
| --- | --- |
| `0` | Unspecified |
| `1` | Right temple |
| `2` | R1 |
| `3` | Left temple |

You can also receive the app's entry into the foreground, entry into the background, abnormal termination, and system shutdown events.

### Device information

The following information can be obtained from `getDeviceInfo()` and device status events.

- Model: G1, G2, Ring1
- Serial number
- Connection status
- Worn status
- Battery level remaining
- Charging status
- Whether it is in the charging case

In the public TypeScript API, a separate list API that enumerates multiple devices at once has not been identified. R1 can be identified by its input source and device model, but R1's raw sensor or health data is not exposed.

### User Information

`getUserInfo()` provides the following account information.

- User UID
- display name
- Avatar URL
- Country code

Use account information only when the app requires it. Describe that use in the privacy policy.

### App Store

The SDK provides these storage APIs:

- `setLocalStorage(key, value)`
- `getLocalStorage(key)`

The value is stored as a string. Because it is stored in the Even Realities app, it can be used even after restarting the app. Browser `localStorage` and IndexedDB may not survive a WebView restart reliably. Prefer SDK storage for persistent data.

### Screens and Images

The SDK supports the following tasks:

- Create a start page container
- Reorganize entire page
- Some text updates
- Update image raw data
- Request to close the app

Images received from a phone camera or album must be reduced to fit the size of the glasses and converted to grayscale before being sent. Large original photos can exceed practical transfer or glasses-memory limits.

## AI, STT and audio processing

### Whether the SDK provides AI and STT

The public method list of `@evenrealities/even_hub_sdk` 0.0.12 was checked on 2026-07-25. It has no AI-model, Even AI, speech-recognition, transcription, prompt, chat-response, or TTS calls. At this checkpoint, the official development document described the released interface as a plugin. It described ‘AI skills’ as a future feature. Built-in Even AI functions do not imply an equivalent API for plugin developers.

The official ASR template also does not include an STT engine. `startSttStream()` is an empty stub. Developers must connect a provider, such as Deepgram, AssemblyAI, Whisper, Soniox, or their own server. The current general flow is as follows.

```text
G2 microphone
16 kHz, signed 16-bit little-endian, mono PCM
        |
        v
Even Hub WebView
audioEvent.audioPcm
        |
        | WebSockets or HTTPS
        v
Developer backend or STT service
        |
        v
Transcript or LLM response
        |
        v
G2 Text and Image Container
```

Connecting to external services requires `network` permission and whitelisting of STT and AI hosts. CORS must also be separately allowed on the server. Build-time keys such as `VITE_STT_API_KEY` can be extracted from packaged JavaScript. Keep secret keys on the backend for a released app.

Local WASM-based STT and small models are possible WebView experiments, not Even-provided features. Evaluate memory, heat, battery use, background behavior, and model-file size on the iPhone. G2 has no speakers, and the public SDK has no audio-output API. Display answers on the glasses or use a separate phone output path.

### G2 Four microphones and sound source direction estimation

The G2 hardware has four microphones, but the official development documentation specifies the plug-in input as '4-mic array, single stream, 16 kHz PCM'. SDK events also provide only the following two values:

- `source`: `glasses` or `phone`
- `audioPcm`: 16 kHz signed 16-bit little-endian mono PCM one stream

`source` identifies G2 or iPhone input. It does not identify individual G2 microphones 1 to 4. Metadata such as channels for each microphone, microphone placement coordinates, phase, time for each sample, and beamforming direction are not disclosed.

A microphone array can estimate a sound source's direction of arrival, or DOA. Time difference of arrival, or TDOA, measures arrival-time differences between microphones. TDOA and phase-difference calculations require synchronized individual channels. This difference cannot be restored after the four channels are combined into one mono stream. Therefore, the Even Hub SDK currently cannot implement DOA, beamforming, or triangulation using four microphones directly.

Even with sufficient channels, a small array mainly estimates direction. Estimating source distance and 3D position is harder. Reflections, multiple sources, glasses position, and microphone spacing also increase errors.

Instead, you can create the following functions with a mono stream:

- Voice section detection
- Classification of keywords and sound events
- STT and real-time subtitles
- Detection of volume, peak and start points
- Pitch or approximate frequency analysis of music

One possible experiment records G2 IMU values and mono-audio level while the user slowly turns their head. It looks for the head direction with the strongest signal. The method assumes one stationary source and sufficient compensation. It does not use arrival-time differences from the four microphones. Gain control, noise suppression, reflections, and uncertain IMU coordinates prevent a precision claim.

## R1 sensor and ring angle

The R1 hardware has an IMU used to calculate activity level and step count. PPG, blood oxygen, HRV and NTC temperature sensors are also used for product functionality. However, the presence of sensors in hardware does not mean that the raw sensors are exposed in the plugin API.

The following is currently confirmed about R1 in the public SDK.

- Tap, double tap, swipe up or down
- Distinguish R1 input source through `eventSource = 2`
- `DeviceModel.Ring1` model value

The following values ​​are not confirmed in the public API.

- Accelerometer or gyroscope raw values ​​of R1
- Absolute or relative angle of the ring
- quaternion, yaw, pitch, roll
- Finger posture or spatial location
- Heart rate, HRV, blood oxygen, body temperature, sleep and steps in R1

The official SDK reference assigns `imuControl()` and `IMU_DATA_REPORT` to the G2 glasses IMU. R1 input events do not include continuous rotation values. Presses and swipes alone cannot establish ring angle. Apps that use R1 angles or raw health data are currently outside the scope of the public plugin SDK.

## Functions available in iOS WebView

The Even Hub plugin is a plain HTML and TypeScript web page inside a Flutter WebView hosted by an Even Realities app. So you can use HTML, CSS, DOM and general JavaScript logic on the phone screen. However, not all Safari APIs are guaranteed to be the same in Even Hub. API availability depends on the iOS version, WebView settings, security context, permissions, and background behavior.

The investigation uses the following compatibility categories.

| Category | Features | Judgment |
| --- | --- | --- |
| Basic web features | HTML, CSS, DOM, ES Modules, Promises, Timers, JSON, URL, Canvas and SVG | Available in Phone WebView UI |
| network | `fetch`, `WebSocket` | Requires `network` permission, whitelist and server CORS |
| calculation | Web Worker, WebAssembly, Web Crypto | Can be used depending on iOS WebKit version, but requires detection of actual device function |
| browser storage | `localStorage`, IndexedDB, Cache API | Do not guarantee existence and retention period, but persistence settings take precedence over SDK repositories |
| media playback | `<audio>`, `<video>` | Only makes sense on phones and may be subject to autoplay and user gesture restrictions |
| Phone sensors and media inputs | Location, Camera, Album, G2 and Phone Microphone | Use Even Hub SDK and manifest permissions rather than plain browser API |
| background | Timers, audio, network, stateful | You should not assume that it continues to live like a regular web page, but rather use the SDK's state saving and restoration flow |
| conditional function | Service Worker, Push, Notifications, Clipboard, Share, File Download | Even though there is no table to guarantee compatibility, do not rely on core features and check actual device |
| Web hardware API not available | Web Bluetooth, WebUSB, WebSerial, WebHID, WebNFC | Not supported by iOS WebKit and cannot be used to connect directly to G2 or R1 |

The DOM and Canvas of the phone's WebView are not automatically mirrored on the G2. G2 output requires separate SDK text, list, and image containers. An iOS version may provide `navigator.geolocation` or `getUserMedia()`. Even Hub officially connects permissions and lifecycle through SDK location, camera, album, and microphone APIs. Prefer those SDK paths for portable core functions and review compliance.

Verify Service Workers and browser storage separately. In WKWebView, Service Worker behavior depends on app-bound domain settings, HTTPS, and the iOS version. Even Hub also documents a separate way to snapshot and restore JSON state between a foreground WebView and a headless WebView. Use `setBackgroundState()` and `onBackgroundRestore()` to restore required state. Do not assume that a Service Worker keeps the app running.

At project start, create a feature-detection screen like this example. Save results from local, private, and beta tests on a real iPhone.

```ts
const capabilities = {
  secureContext: window.isSecureContext,
  fetch: typeof window.fetch === 'function',
  webSocket: typeof window.WebSocket === 'function',
  indexedDb: 'indexedDB' in window,
  serviceWorker: 'serviceWorker' in navigator,
  mediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
  webAssembly: typeof WebAssembly === 'object',
  webCrypto: Boolean(crypto?.subtle),
  webBluetooth: 'bluetooth' in navigator,
}
```

Local QR tests often use HTTP addresses, so APIs that require a secure context may look different from packaged HTTPS or beta environments. Repeat feature detection and hardware verification with the final distribution package.

## Features not confirmed in public SDK

Currently, the official public SDK does not provide the following features:

- Bluetooth connection directly from the app to your G2 or R1
- G2's camera
- Speaker or audio output
- Even AI, LLM, STT and TTS calls
- R1 raw motion sensor
- R1 angle and posture
- R1 health and biometric information
- Four raw audio channels per G2 microphone
- Beamforming or sound source direction metadata of microphone array
- iPhone contacts
- iPhone Calendar
- iPhone notification history
- HealthKit
- Generic HTML and CSS rendering for glasses screens
- Arbitrary fonts and text alignment
- Background colors and general UI animations
- Color image

An image container can display a bitmap. The API does not provide direct pixel drawing on the glasses like a regular Canvas.

## Packaging and publishing

Once development is complete, build the app and package it as a `.ehpk` file.

```powershell
npm run build
npx evenhub pack app.json dist -o my-app.ehpk
```

The created file is uploaded to the Even Hub developer portal for review and posting procedures.

Some support documents call upload files `.ehp`. The public CLI and official templates reviewed here use `.ehpk`. For uploads, use the extension required by the installed CLI and developer portal.

## Paid Sales Policy

### What is confirmed in the Terms and Conditions

The Even Hub Terms of Use, updated on 2026-03-24, state that users may use, license, subscribe to or download plugins. Payment obligations for developer plugins lie between the user and developer. The developer terms assign independent sales activities, risks, and responsibilities to the developer.

The terms allow for paid licenses and subscriptions. They do not establish that Even Hub provides payment buttons or settlement functions.

| Item | Status confirmed from public data |
| --- | --- |
| Paid usage or subscription concept | In Terms of Use |
| Even Hub's own payment SDK and checkout | Not confirmed |
| Price setting screen | Not confirmed |
| Even's Sales Commission and Revenue Share | Not confirmed |
| Payout cycle, minimum payout, supported currencies | Not confirmed |
| Refund, Cancellation, and Dispute Processing Procedures | Couldn't find detailed policy for developer plugin |
| Value added tax and tax treatment by country | There is no public settlement document and it appears to be the scope of developer liability |
| External accounts and self-subscriptions | The terms and conditions stipulate that third-party plugins can have separate account systems, but acceptable payment methods need to be confirmed separately |

The terms contemplate paid sales. This investigation did not confirm a public payment or settlement system. Before launch, ask Even Realities to confirm acceptable payment methods in writing. Ask about external web payments, iOS in-app payments, invitation codes, and developer-managed subscriptions.

### Conditions you need to know when creating a paid app

- Developers are responsible for the functionality, security, availability, customer support, and their own terms and conditions of the plugin.
- If permission or personal information is used, the collection items, purpose and processing method must be specifically written in the personal information processing policy.
- An `.ehpk` bundle can be extracted. Keep API secrets, payment secrets, and license decisions out of that bundle. Verify paid access on the server.
- Posted plugins and Developer Content are granted to Even Realities a broad, non-exclusive, transferable, sublicensable, royalty-free, worldwide license to use them to operate, distribute, improve and promote the Platform. Although the developer's existing intellectual property rights themselves are not transferred, the scope of the contract needs to be reviewed before launch.
- Financial products and services, health and medical care, education and training, instant messaging, services aimed at children, and other apps deemed risky are currently excluded from publication.
- After release, the burden of security testing and support remains on the developer. The terms require published plugins to be security checked at least every six months.

Validate the product in a free or closed beta first. Before implementing payments, request written answers to the following questions:

1. Whether Korean developers can register paid plugins
2. Accepted payment providers and payment flows
3. Whether prices can be displayed within Even Hub
4. Responsibility for fees, refunds, value-added tax, receipts and settlement
5. How plugin usage rights are handled when canceling subscription and deleting account

## App review process and period

### Official Procedure

The app status in the developer portal progresses in the following order: `Draft`, `Test`, `Submitted`, and `Released`. After submission, the portal assigns the app to a reviewer. The reviewer performs manual QA, including installation and execution, and then approves or rejects. The main confirmation items are as follows.

- Manifest and version
- Icons, banners and screenshots
- Privacy policy explaining all permissions requested
- Initial execution and setup flow
- Network requests and CORS
- iPhone locked state and app life cycle
- Termination handling and user safety

`Released` builds cannot be modified and modifications require submitting a new build with a higher version. Plan for each update to receive another review.

### Review period

As of 2026-07-25, the reviewed submission documents and developer terms specified no processing deadline, service-level commitment, or average or median review duration. The reviewed community posts did not provide enough reliable approval times to calculate an average. In May 2026, a developer wrote that he had no idea how long it would take for an app to be approved after submitting it. At the time of the initial Hub release, there was a developer post saying that the fix was awaiting Even's review.

The official pilot program document's 'expected response within 10 business days' is the goal for early developer access applications. That target concerns early access, not publication review of a completed app. Do not use it as an app-review estimate. The ‘within 48 hours’ case mentioned in the community is also a case of beta access approval, not app review.

Use the following scheduling assumptions.

- Do not promise review completion by a fixed public release date.
- Both the first submission and update are external dependencies with an indefinite period.
- Use local testing, closed testing, and beta distribution while awaiting public review.
- Beta operates under similar conditions to `Released`, so it first verifies iPhone lock status, running for more than 5 minutes, and network and shutdown flow.

## Korean community and developer activities

### Verification result

As of 2026-07-25, public searches found no official Korean Even Realities community, Korean Discord, Naver Cafe, or Korean-only developer group. It was not possible to fully check the inside of Naver Cafe due to search robot restrictions. There may also be private chat rooms or small gatherings that are not visible through public searches.

The official and representative global channels currently confirmed are as follows.

| Channel | Use | Korean only |
| --- | --- | --- |
| Official Even Realities Discord | Development questions, bug reports, feature opinions, exchanges between developers | Not |
| Community subreddit `r/EvenRealities` | Product and Even Hub usage experience, development discussion | Not |
| Even Realities GitHub | Official templates, SDK support materials, issues and open code | Not |

There are still few public traces in the Korean-speaking world.

- There are user reviews on the Korean App Store that describe their experience with Korean support for G2’s core features.
- Hyeong Jun Huh, an engineer who revealed that he lives in Korea, summarized the actual use of G2 and the WebView-based plugin structure in Korean on 2026-07-14.
- The Discord linked in this article is a general entrepreneur and developer community and is not a Korean community dedicated to Even Realities.
- I could not find any repositories or public plugins using the Even Hub SDK on this author's public GitHub. Therefore, it is confirmed that he is an engineer living in Korea who owns a G2, but there is insufficient evidence to conclude that he is a developer of the public Even Hub app.

We also sampled the top 100 searched `"Even G2"` repositories on GitHub and the public profile locations of the repository owners. Owners who identified themselves as `Korea`, `Seoul`, `Korea`, or `Republic of Korea` did not appear. The sample could omit undisclosed locations, organizations, private projects, and repositories using different terms. It does not establish that Korean developers are absent.

The investigation supports these conclusions.

- Interest from Korean users and developers is confirmed.
- Introductions to practical use and development structures in Korean have also begun to appear.
- Public evidence for a dedicated community and Korean Even Hub open-source ecosystem remained limited.
- For technical support, use the official Discord developer channel or official GitHub.
- As the number of Korean users increases, it is realistic to request Korean threads or channels within the official Discord and collect data in a public GitHub organization or document repository.

## Currently confirmed public package

The version confirmed in npm registry on 2026-07-25 is as follows.

| package | Check version |
| --- | --- |
| `@evenrealities/even_hub_sdk` | `0.0.12` |
| `@evenrealities/evenhub-cli` | `0.1.13` |

The template may declare an older minimum version. Match the installed SDK version with `min_sdk_version` in `app.json`.

## Recommended first experiment

Verify the complete path with a small app that has only these features:

1. Display one line of text in G2 in the `minimal` template.
2. Change the display text by pressing R1.
3. Double-click to open the app termination confirmation window.
4. Check the screen and events in the simulator.
5. Scan the QR code on your iPhone on the same Wi-Fi.
6. Verify the input source and screen on the actual G2 and R1.

After this flow succeeds, add microphone, location, network API, and image features in that order. Check each addition before proceeding.

## Items requiring additional confirmation

- Actual payment flows and payment operators accepted by Even Hub
- Pricing, fees, refunds, taxes and settlement methods
- Whether Korean personal or business accounts can post paid posts
- Whether the battery status of R1 can be checked separately from G2
- Physical units, coordinate system and accuracy of IMU `x`, `y`, `z` guaranteed by the manufacturer
- Actual behavior of microphone and location update when switching background in iOS
- Official processing goals and actual approval period statistics for app review
- Emergence of an official or homegrown Korean Even Realities developer group
- Four microphone preprocessing, automatic gain adjustment and noise suppression method in G2 firmware
- WebView function detection results by iOS version and Even Realities app version

## Source

All links were verified on 2026-07-25.

- [Even Hub Developer Portal](https://hub.evenrealities.com/)
- [Even Hub Development Document Overview](https://hub.evenrealities.com/docs)
- [Even Hub Support Document](https://support.evenrealities.com/hc/en-us/articles/15688149217167-Even-Hub)
- [Even Hub Terms of Use](https://support.evenrealities.com/hc/en-us/articles/15606749676175-Even-Hub-Terms-of-Service)
- [Even Hub Developer Platform Terms](https://support.evenrealities.com/hc/en-us/articles/15606676690703-Even-Hub-Developer-Platform-Terms-of-Service)
- [Even Hub Developer Data Processing Agreement](https://support.evenrealities.com/hc/en-us/articles/15606721200911-Even-Hub-Developer-Platform-Data-Processing-Agreement)
- [App submission and review document](https://hub.evenrealities.com/docs/ship/app-submission)
- [Packaging Document](https://hub.evenrealities.com/docs/ship/packaging)
- [Test method overview](https://hub.evenrealities.com/docs/test)
- [Beta Test Document](https://hub.evenrealities.com/docs/test/beta-testing)
- [Even Hub Pilot Program](https://support.evenrealities.com/hc/en-us/articles/15016109505679-Even-Hub-Pilot-Program)
- [Official Device APIs Document](https://hub.evenrealities.com/docs/build/device-apis)
- [Introduction to G2 sensor design](https://www.evenrealities.com/zh-Hant-NO/blogs/even-insider/how-we-shaped-even-g2-from-the-outside-in)
- [Even Realities Official GitHub](https://github.com/even-realities)
- [Official Even Hub Starter Template](https://github.com/even-realities/evenhub-templates)
- [Official minimal template](https://github.com/even-realities/evenhub-templates/tree/main/minimal)
- [Official ASR template](https://github.com/even-realities/evenhub-templates/tree/main/asr)
- [STT connection description in the official ASR template](https://github.com/even-realities/evenhub-templates/blob/main/asr/README.md)
- [Everything EvenHub development materials](https://github.com/even-realities/everything-evenhub)
- [Full SDK method and event reference](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/sdk-reference/SKILL.md)
- [WebView background state storage and restoration reference](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/background-state/SKILL.md)
- [Device feature reference](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/device-features/SKILL.md)
- [Input event reference](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/handle-input/SKILL.md)
- [Packaging and permissions reference](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/build-and-deploy/SKILL.md)
- [Simulator Reference](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/test-with-simulator/SKILL.md)
- [Even Hub SDK npm package](https://www.npmjs.com/package/@evenrealities/even_hub_sdk)
- [Even Hub CLI npm package](https://www.npmjs.com/package/@evenrealities/evenhub-cli)
- [Even Hub Simulator npm package](https://www.npmjs.com/package/@evenrealities/evenhub-simulator)
- [Even R1 sensor specifications](https://support.evenrealities.com/hc/en-us/articles/13500531254159-Specs)
- [Even R1 operation and health data guide](https://support.evenrealities.com/hc/en-us/articles/13772400722063-How-to-Control)
- [List of hardware Web APIs not intentionally provided by WebKit](https://webkit.org/tracking-prevention/)
- [Study on sound source direction estimation using TDOA of microphone pair](https://pure.kaist.ac.kr/en/publications/microphone-pair-training-for-robust-sound-source-localization-wit/)
- [Public level app `level-even-g2`](https://github.com/nickustinov/level-even-g2)
- [Public posture notification app `even-g2-posture`](https://github.com/unicco/even-g2-posture)
- [Public head exercise app `eyefit-g2`](https://github.com/aleapc/eyefit-g2)
- [Public pickleball auxiliary app `pickleball-even-g2`](https://github.com/hitching/pickleball-even-g2)
- [Public IMU recording experiment `locate-sound`](https://github.com/KevinBalkoski/locate-sound/blob/main/src/spikes/imu-logger.ts)
- [Official Even Realities Discord Invitation](https://discord.gg/Y4jHMCU4sv)
- [Reddit `r/EvenRealities`](https://www.reddit.com/r/EvenRealities/)
- [Korean G2 actual use and development structure review](https://cse.ac/jun/even-g2-review/)
- [Even Realities app on the Korean App Store](https://apps.apple.com/kr/app/even-realities/id6747017725)
- [Public developer post mentioning that app review period is unknown](https://www.reddit.com/r/EvenRealities/comments/1t6epob/has_anyone_built_a_flight_tracker_for_the_even/)
