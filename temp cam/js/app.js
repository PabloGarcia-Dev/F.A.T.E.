import {
  startScanner,
  stopScanner,
  submitManualBarcode,
} from "./scanner.js";

function handleBarcodeDetected(barcode) {
  console.log("Detected barcode:", barcode);

  // Integration point: pass `barcode` to the API teammate's lookup function.
  const output = document.querySelector("#barcode-result");
  output.textContent = `Barcode ready: ${barcode}`;
}

document.querySelector("#scan-button").addEventListener("click", () => {
  startScanner(handleBarcodeDetected);
});

document
  .querySelector("#close-scanner-button")
  .addEventListener("click", stopScanner);

document
  .querySelector("#manual-barcode-button")
  .addEventListener("click", () => submitManualBarcode(handleBarcodeDetected));

document
  .querySelector("#manual-barcode-input")
  .addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitManualBarcode(handleBarcodeDetected);
  });

