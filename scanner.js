const ZXING_CDN_URL =
  "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js";

const SELECTORS = {
  modal: "#scanner-modal",
  video: "#scanner-video",
  status: "#scanner-status",
  scanButton: "#start-scan-button", // Maps to your floating footer camera button precisely
  manualInput: "#manual-barcode-input",
  manualError: "#manual-barcode-error",
};

let codeReader = null;
let scannerControls = null;
let libraryPromise = null;
let scanSession = 0;
let resultHandled = false;

function getVideoTrack(video) {
  const stream = video?.srcObject;
  if (!(stream instanceof MediaStream)) return null;
  return stream.getVideoTracks()[0] || null;
}

/** Applies continuous autofocus on the live track where the browser supports it. */
async function applyContinuousFocus(video) {
  const track = getVideoTrack(video);
  if (!track || typeof track.getCapabilities !== "function") return;

  try {
    const capabilities = track.getCapabilities();
    console.log("Camera track capabilities:", capabilities);

    if (capabilities.focusMode?.includes("continuous")) {
      await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
    } else {
      console.log("This camera/browser does not report support for programmatic focus control.");
    }
  } catch (error) {
    console.warn("Could not apply continuous focus:", error);
  }
}

/** Nudges the camera to refocus once — useful as a manual fallback where
 * continuous autofocus isn't supported or has locked onto the wrong distance. */
async function triggerSingleShotFocus(video) {
  const track = getVideoTrack(video);
  if (!track || typeof track.getCapabilities !== "function") return;

  try {
    const capabilities = track.getCapabilities();

    if (capabilities.focusMode?.includes("single-shot")) {
      await track.applyConstraints({ advanced: [{ focusMode: "single-shot" }] });
      setStatus("Refocusing…");
    }
  } catch (error) {
    console.warn("Could not trigger single-shot focus:", error);
  }
}

function getElement(selector) {
  return document.querySelector(selector);
}

function setStatus(message, type = "info") {
  const status = getElement(SELECTORS.status);

  if (status) {
    status.textContent = message;
    status.dataset.type = type;
  }
}

function showModal() {
  const modal = getElement(SELECTORS.modal);

  if (!modal) {
    throw new Error("Scanner UI is missing #scanner-modal.");
  }

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("scanner-open");
}

function hideModal() {
  const modal = getElement(SELECTORS.modal);

  if (modal) {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  document.body.classList.remove("scanner-open");
}

function loadZxing() {
  if (window.ZXingBrowser?.BrowserMultiFormatReader) {
    return Promise.resolve(window.ZXingBrowser);
  }

  if (libraryPromise) {
    return libraryPromise;
  }

  libraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = ZXING_CDN_URL;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      if (window.ZXingBrowser?.BrowserMultiFormatReader) {
        resolve(window.ZXingBrowser);
      } else {
        reject(new Error("The barcode scanner library did not initialize."));
      }
    };
    script.onerror = () => {
      libraryPromise = null;
      reject(new Error("The barcode scanner library could not be downloaded."));
    };
    document.head.append(script);
  });

  return libraryPromise;
}

function cameraErrorMessage(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera access was denied. Allow camera permission in your browser settings, or enter the barcode manually below.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera was found on this device. Enter the barcode manually below.";
    case "NotReadableError":
    case "TrackStartError":
      return "The camera is already in use or could not be started. Close other camera apps and try again, or enter the barcode manually.";
    case "OverconstrainedError":
      return "The available camera does not support the requested settings. Try again or enter the barcode manually.";
    default:
      return "The camera could not be started. Check browser permissions and try again, or enter the barcode manually.";
  }
}

/**
 * Starts a camera scan and reports one barcode through the supplied callback.
 * ZXing's multi-format reader supports UPC-A, UPC-E, EAN-13, EAN-8, and other
 * common grocery barcode formats. The camera is stopped before the callback.
 */
export async function startScanner(onBarcodeDetected) {
  if (typeof onBarcodeDetected !== "function") {
    throw new TypeError("startScanner requires a barcode callback function.");
  }

  // End any previous session before creating a new one.
  stopScanner();
  const currentSession = ++scanSession;
  resultHandled = false;

  const video = getElement(SELECTORS.video);
  if (!video) {
    throw new Error("Scanner UI is missing #scanner-video.");
  }

  video.addEventListener("click", handleVideoTap);

  showModal();
  setStatus("Starting camera…");

  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    setStatus(
      "Camera scanning requires HTTPS (or localhost) in a supported browser. Enter the barcode manually below.",
      "error",
    );
    return;
  }

  try {
    const ZXingBrowser = await loadZxing();

    // Ignore an async start that finished after the user cancelled.
    if (currentSession !== scanSession) return;

    // Restrict decoding to grocery barcode formats only. Scanning every format
    // ZXing supports (QR, PDF417, Data Matrix, Aztec, etc.) on every frame slows
    // down each attempt for no benefit here, since none of those ever appear on
    // grocery packaging. Narrowing the format list speeds up detection and cuts
    // down on false negatives caused by wasted decode attempts.
    // NOTE: deliberately NOT using DecodeHintType.TRY_HARDER — it has a known bug
    // that silently freezes continuous video decoding in @zxing/browser.
    // https://github.com/zxing-js/browser/issues/74
    let hints;
    if (ZXingBrowser.DecodeHintType && ZXingBrowser.BarcodeFormat) {
      hints = new Map();
      hints.set(ZXingBrowser.DecodeHintType.POSSIBLE_FORMATS, [
        ZXingBrowser.BarcodeFormat.EAN_13,
        ZXingBrowser.BarcodeFormat.EAN_8,
        ZXingBrowser.BarcodeFormat.UPC_A,
        ZXingBrowser.BarcodeFormat.UPC_E,
        ZXingBrowser.BarcodeFormat.CODE_128,
      ]);
    }

    codeReader = new ZXingBrowser.BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 150,
      delayBetweenScanSuccess: 1000,
    });

    setStatus("Position the entire barcode inside the guide.");

    const controls = await codeReader.decodeFromConstraints(
      {
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          // Barcodes need pixel detail more than frame rate — pushing
          // resolution higher gives the decoder more to work with,
          // especially on smaller or worn labels.
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          // Ask for continuous autofocus where supported, so the camera
          // keeps refocusing on a close-up object instead of settling on
          // a fixed/slow focus that never quite locks onto the barcode.
          advanced: [{ focusMode: "continuous" }],
        },
      },
      video,
      (result) => {
        // Continuous decoding can report the same frame more than once. This
        // lock ensures the app receives exactly one result per scan session.
        if (!result || resultHandled || currentSession !== scanSession) return;

        resultHandled = true;
        const barcode = result.getText().trim();

        if (!barcode) {
          resultHandled = false;
          return;
        }

        stopScanner();
        onBarcodeDetected(barcode);
      },
    );

    // A result or cancel action can happen while the reader promise is
    // settling. Do not retain controls from a session that has already ended.
    if (currentSession !== scanSession) {
      controls.stop();
      return;
    }

    scannerControls = controls;

    // Some browsers silently ignore focusMode when it's passed as part of the
    // initial getUserMedia constraints. Re-applying it directly on the live
    // track is more reliable where the browser supports it at all.
    // NOTE: this only works on browsers that expose focus control at all —
    // notably Chrome on Android. iOS Safari does not support programmatic
    // focus control (no ImageCapture / focusMode support), so this is a
    // best-effort improvement, not a guarantee across all devices.
    applyContinuousFocus(video);
  } catch (error) {
    if (currentSession !== scanSession) return;

    console.error("Unable to start barcode scanner:", error);
    stopCameraTracks();

    const message = error?.message?.includes("downloaded")
      ? `${error.message} Check your connection, or enter the barcode manually below.`
      : cameraErrorMessage(error);
    setStatus(message, "error");
  }
}

function handleVideoTap() {
  const video = getElement(SELECTORS.video);
  if (video) triggerSingleShotFocus(video);
}

function stopCameraTracks() {
  if (scannerControls) {
    scannerControls.stop();
    scannerControls = null;
  }

  const video = getElement(SELECTORS.video);
  const stream = video?.srcObject;

  if (stream instanceof MediaStream) {
    stream.getTracks().forEach((track) => track.stop());
  }

  if (video) {
    video.pause();
    video.srcObject = null;
    video.removeEventListener("click", handleVideoTap);
  }

  codeReader = null;
}

/** Stops decoding, releases every camera track, and closes the scanner UI. */
export function stopScanner() {
  scanSession += 1;
  resultHandled = false;
  stopCameraTracks();
  hideModal();
}

/** Returns a helpful error string, or an empty string when the value is valid. */
export function validateManualBarcode(value) {
  const barcode = String(value ?? "").trim();

  if (!/^\d+$/.test(barcode)) {
    return "Use digits only—do not include spaces or dashes.";
  }

  // Six through eight digits covers common UPC-E representations; 12 and 13
  // cover UPC-A and EAN-13. EAN-8 is included in the first group.
  if (![6, 7, 8, 12, 13].includes(barcode.length)) {
    return "Enter a 6–8, 12, or 13 digit UPC/EAN barcode.";
  }

  return "";
}

/** Validates the manual field and reports it through the same app callback. */
export function submitManualBarcode(onBarcodeDetected) {
  if (typeof onBarcodeDetected !== "function") {
    throw new TypeError("submitManualBarcode requires a barcode callback function.");
  }

  const input = getElement(SELECTORS.manualInput);
  const errorElement = getElement(SELECTORS.manualError);
  const barcode = input?.value.trim() ?? "";
  const errorMessage = validateManualBarcode(barcode);

  if (errorElement) errorElement.textContent = errorMessage;
  input?.setAttribute("aria-invalid", String(Boolean(errorMessage)));

  if (errorMessage) {
    input?.focus();
    return null;
  }

  stopScanner();
  onBarcodeDetected(barcode);
  return barcode;
}

// Always release camera hardware when navigating away or suspending the page.
window.addEventListener("pagehide", stopScanner);