const elements = {
  fileInput: document.getElementById("file-input"),
  uploadLabel: document.getElementById("upload-label"),
  downloadButton: document.getElementById("download-button"),
  statusText: document.getElementById("status-text"),
  summaryPrimary: document.getElementById("summary-primary"),
  summarySecondary: document.getElementById("summary-secondary"),
  errorBanner: document.getElementById("error-banner"),
  emptyState: document.getElementById("empty-state"),
  standalonePanel: document.getElementById("standalone-panel"),
  standaloneTitle: document.getElementById("standalone-title"),
  standaloneMeta: document.getElementById("standalone-meta"),
  standaloneToolbar: document.getElementById("standalone-toolbar"),
  modeBadge: document.getElementById("mode-badge"),
  pdfToolbar: document.getElementById("pdf-toolbar"),
  mediaToolbar: document.getElementById("media-toolbar"),
  replaceFileButton: document.getElementById("replace-file-button"),
  textEditor: document.getElementById("text-editor"),
  hexEditor: document.getElementById("hex-editor"),
  pdfViewer: document.getElementById("pdf-viewer"),
  pdfPageList: document.getElementById("pdf-page-list"),
  pdfSidebarMeta: document.getElementById("pdf-sidebar-meta"),
  pdfStageEmpty: document.getElementById("pdf-stage-empty"),
  pdfPageFrame: document.getElementById("pdf-page-frame"),
  pdfPageTitle: document.getElementById("pdf-page-title"),
  pdfPageMeta: document.getElementById("pdf-page-meta"),
  pdfCanvas: document.getElementById("pdf-canvas"),
  pdfAnnotationLayer: document.getElementById("pdf-annotation-layer"),
  pdfAddHighlight: document.getElementById("pdf-add-highlight"),
  pdfAddNote: document.getElementById("pdf-add-note"),
  pdfRotatePage: document.getElementById("pdf-rotate-page"),
  pdfMovePageUp: document.getElementById("pdf-move-page-up"),
  pdfMovePageDown: document.getElementById("pdf-move-page-down"),
  pdfRemovePage: document.getElementById("pdf-remove-page"),
  imageViewer: document.getElementById("image-viewer"),
  imagePreview: document.getElementById("image-preview"),
  imageType: document.getElementById("image-type"),
  imageDimensions: document.getElementById("image-dimensions"),
  imageSize: document.getElementById("image-size"),
  videoViewer: document.getElementById("video-viewer"),
  videoPreview: document.getElementById("video-preview"),
  videoType: document.getElementById("video-type"),
  videoDuration: document.getElementById("video-duration"),
  videoSize: document.getElementById("video-size"),
  fallbackPanel: document.getElementById("fallback-panel"),
  fallbackTitle: document.getElementById("fallback-title"),
  fallbackCopy: document.getElementById("fallback-copy"),
  fallbackSize: document.getElementById("fallback-size"),
  zipPanel: document.getElementById("zip-panel"),
  zipTitle: document.getElementById("zip-title"),
  entryList: document.getElementById("entry-list"),
  entryTitle: document.getElementById("entry-title"),
  entryMeta: document.getElementById("entry-meta"),
  zipEditor: document.getElementById("zip-editor"),
  readonlyPanel: document.getElementById("readonly-panel"),
  readonlyTitle: document.getElementById("readonly-title"),
  readonlyCopy: document.getElementById("readonly-copy"),
  readonlySize: document.getElementById("readonly-size")
};

let currentDocument = null;
let pendingReplacement = false;

bindEvents();
render();

function bindEvents() {
  elements.fileInput.addEventListener("change", handleUpload);
  elements.downloadButton.addEventListener("click", downloadCurrent);
  elements.textEditor.addEventListener("input", handleTextEdit);
  elements.hexEditor.addEventListener("input", handleHexEdit);
  elements.zipEditor.addEventListener("input", handleZipEntryEdit);
  elements.replaceFileButton.addEventListener("click", () => {
    pendingReplacement = true;
    elements.fileInput.click();
  });
  elements.pdfAddHighlight.addEventListener("click", () => setPdfTool(currentDocument, elements, "highlight"));
  elements.pdfAddNote.addEventListener("click", () => setPdfTool(currentDocument, elements, "note"));
  elements.pdfRotatePage.addEventListener("click", rotateSelectedPdfPage);
  elements.pdfMovePageUp.addEventListener("click", () => moveSelectedPdfPage(-1));
  elements.pdfMovePageDown.addEventListener("click", () => moveSelectedPdfPage(1));
  elements.pdfRemovePage.addEventListener("click", removeSelectedPdfPage);
  elements.pdfAnnotationLayer.addEventListener("pointerdown", (event) => withPdfDocument(() => beginPdfAnnotation(currentDocument, elements, event, refreshPdfAfterEdit)));
  elements.pdfAnnotationLayer.addEventListener("pointermove", (event) => withPdfDocument(() => updatePdfAnnotation(currentDocument, elements, event)));
  elements.pdfAnnotationLayer.addEventListener("pointerup", () => withPdfDocument(() => finishPdfAnnotation(currentDocument, elements, refreshPdfAfterEdit)));
  elements.pdfAnnotationLayer.addEventListener("pointerleave", () => withPdfDocument(() => cancelDraftAnnotation(currentDocument, elements)));
}

async function handleUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  setLoading(true);
  setError("");
  try {
    releaseCurrentResources();
    currentDocument = await createDocument(file);
    pendingReplacement = false;
    render();
  } catch (error) {
    currentDocument = null;
    render();
    setError(error instanceof Error ? error.message : "Unable to load that file.");
  } finally {
    setLoading(false);
    event.target.value = "";
  }
}

async function createDocument(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileName = file.name || "untitled.bin";
  const mime = file.type || inferMime(fileName, bytes);
  if (looksLikeZip(bytes, fileName)) {
    return { kind: "zip", fileName, mime: "application/zip", entries: await parseZip(bytes), selectedPath: null, dirty: false };
  }
  const mode = resolveStandaloneMode(fileName, mime, bytes);
  if (mode === "text") return { kind: "standalone", mode, fileName, mime, bytes, text: textDecoder.decode(bytes), dirty: false };
  if (mode === "hex") return { kind: "standalone", mode, fileName, mime, bytes, hex: formatHex(bytes), dirty: false };
  if (mode === "pdf") {
    const document = { kind: "standalone", mode, fileName, mime: "application/pdf", bytes, objectUrl: null, pdfjsDocument: null, pages: [], selectedPageIndex: 0, activeTool: "highlight", dirty: false };
    await hydratePdfDocument(document);
    return document;
  }
  const objectUrl = URL.createObjectURL(new Blob([bytes], { type: mime || "application/octet-stream" }));
  const metadata = mode === "image" ? await loadImageMetadata(objectUrl) : await loadVideoMetadata(objectUrl, mime);
  return { kind: "standalone", mode, fileName, mime, bytes, objectUrl, metadata, dirty: false };
}

function render() {
  const hasDocument = Boolean(currentDocument);
  elements.emptyState.hidden = hasDocument;
  elements.downloadButton.disabled = !hasDocument;
  if (!currentDocument) {
    elements.standalonePanel.hidden = true;
    elements.zipPanel.hidden = true;
    elements.statusText.textContent = "Upload any file to begin.";
    elements.summaryPrimary.textContent = "Nothing loaded";
    elements.summarySecondary.textContent = "The viewer will update here once a file is opened.";
    return;
  }
  currentDocument.kind === "zip" ? renderZip() : renderStandalone();
  renderSummary();
}

function renderStandalone() {
  hideStandaloneModes();
  elements.standalonePanel.hidden = false;
  elements.zipPanel.hidden = true;
  elements.standaloneToolbar.hidden = false;
  elements.standaloneTitle.textContent = currentDocument.fileName;
  elements.modeBadge.textContent = currentDocument.mode;
  elements.pdfToolbar.hidden = currentDocument.mode !== "pdf";
  elements.mediaToolbar.hidden = currentDocument.mode !== "image" && currentDocument.mode !== "video";
  if (currentDocument.mode === "text") {
    elements.textEditor.hidden = false;
    elements.textEditor.value = currentDocument.text;
    elements.standaloneMeta.textContent = "Text mode. Edit directly and export with the same file name.";
  } else if (currentDocument.mode === "hex") {
    elements.hexEditor.hidden = false;
    elements.hexEditor.value = currentDocument.hex;
    elements.fallbackPanel.hidden = false;
    elements.fallbackTitle.textContent = "Binary fallback mode";
    elements.fallbackCopy.textContent = "This format does not have a dedicated browser viewer yet, so it is open in hex mode.";
    elements.fallbackSize.textContent = formatBytes(currentDocument.bytes.length);
    elements.standaloneMeta.textContent = "Hex mode for unsupported binary formats.";
  } else if (currentDocument.mode === "pdf") {
    elements.pdfViewer.hidden = false;
    elements.standaloneMeta.textContent = "PDF mode with preview, page operations, and lightweight annotations.";
    renderPdfPageList(currentDocument, elements, selectPdfPage);
    renderPdfPage(currentDocument, elements);
  } else if (currentDocument.mode === "image") {
    elements.imageViewer.hidden = false;
    elements.imagePreview.src = currentDocument.objectUrl;
    elements.imageType.textContent = currentDocument.mime || "image";
    elements.imageDimensions.textContent = currentDocument.metadata.width + " x " + currentDocument.metadata.height;
    elements.imageSize.textContent = formatBytes(currentDocument.bytes.length);
    elements.standaloneMeta.textContent = "Native browser image preview with replacement support.";
  } else if (currentDocument.mode === "video") {
    elements.videoViewer.hidden = false;
    elements.videoPreview.src = currentDocument.objectUrl;
    elements.videoType.textContent = currentDocument.mime || "video";
    elements.videoDuration.textContent = currentDocument.metadata.durationLabel;
    elements.videoSize.textContent = formatBytes(currentDocument.bytes.length);
    elements.standaloneMeta.textContent = "Native browser video preview with replacement support.";
  }
  elements.statusText.textContent = "Loaded " + currentDocument.fileName + " in " + currentDocument.mode + " mode.";
}

function renderZip() {
  elements.standalonePanel.hidden = true;
  elements.zipPanel.hidden = false;
  elements.zipTitle.textContent = currentDocument.fileName;
  if (!currentDocument.selectedPath) currentDocument.selectedPath = (currentDocument.entries.find((entry) => !entry.directory) || {}).path || null;
  elements.entryList.innerHTML = "";
  currentDocument.entries.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "entry-button" + (entry.path === currentDocument.selectedPath ? " is-active" : "");
    button.disabled = entry.directory;
    button.innerHTML = "<strong>" + entry.name + "</strong><span>" + entry.path + "</span><small>" + (entry.directory ? "Folder" : entry.editable ? (entry.dirty ? "Editable, changed" : "Editable") : "Read-only binary") + "</small>";
    button.addEventListener("click", () => {
      currentDocument.selectedPath = entry.path;
      renderZip();
    });
    elements.entryList.appendChild(button);
  });
  const entry = currentDocument.entries.find((item) => item.path === currentDocument.selectedPath);
  if (entry && entry.editable && entry.text !== null) {
    elements.entryTitle.textContent = entry.path;
    elements.entryMeta.textContent = "Compression in source zip: method " + entry.originalCompression + ".";
    elements.readonlyPanel.hidden = true;
    elements.zipEditor.hidden = false;
    elements.zipEditor.value = entry.text;
  } else {
    elements.entryTitle.textContent = entry ? entry.path : "No file selected";
    elements.entryMeta.textContent = entry ? "Preview unavailable for this entry." : "Choose an archive item to inspect it.";
    elements.zipEditor.hidden = true;
    elements.readonlyPanel.hidden = false;
    elements.readonlyTitle.textContent = entry ? "Preview unavailable" : "Select a file from the archive";
    elements.readonlyCopy.textContent = entry ? "This entry stays preserved during export." : "Choose an item from the left to inspect or edit it.";
    elements.readonlySize.hidden = !entry;
    elements.readonlySize.textContent = entry ? formatBytes(entry.bytes.length) : "";
  }
  elements.statusText.textContent = "Loaded " + currentDocument.fileName + " with " + currentDocument.entries.length + " archive items.";
}

function handleTextEdit(event) { if (withStandaloneMode("text")) { currentDocument.text = event.target.value; currentDocument.bytes = textEncoder.encode(event.target.value); markCurrentDirty(); } }
function handleHexEdit(event) { if (withStandaloneMode("hex")) try { setError(""); const bytes = parseHexString(event.target.value); currentDocument.hex = formatHex(bytes); currentDocument.bytes = bytes; event.target.value = currentDocument.hex; markCurrentDirty(); } catch (error) { setError(error.message || "Invalid hex input."); } }
function handleZipEntryEdit(event) { if (currentDocument && currentDocument.kind === "zip") { const entry = currentDocument.entries.find((item) => item.path === currentDocument.selectedPath); if (entry && entry.editable) { entry.text = event.target.value; entry.bytes = textEncoder.encode(event.target.value); entry.dirty = true; markCurrentDirty(); } } }

async function downloadCurrent() {
  if (!currentDocument) return;
  let blob;
  if (currentDocument.kind === "zip") {
    blob = new Blob([createZipArchive(currentDocument.entries)], { type: "application/zip" });
    currentDocument.entries.forEach((entry) => { entry.dirty = false; });
  } else if (currentDocument.mode === "pdf") {
    currentDocument.bytes = await exportPdf(currentDocument);
    blob = new Blob([currentDocument.bytes], { type: "application/pdf" });
  } else {
    blob = new Blob([currentDocument.bytes], { type: currentDocument.mime || "application/octet-stream" });
  }
  currentDocument.dirty = false;
  triggerDownload(blob, currentDocument.fileName);
  renderSummary();
}

function rotateSelectedPdfPage() { withPdfDocument(() => { currentDocument.pages[currentDocument.selectedPageIndex].rotation = (currentDocument.pages[currentDocument.selectedPageIndex].rotation + 90) % 360; markCurrentDirty(); renderStandalone(); }); }
function moveSelectedPdfPage(direction) { withPdfDocument(() => { const index = currentDocument.selectedPageIndex; const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= currentDocument.pages.length) return; const [page] = currentDocument.pages.splice(index, 1); currentDocument.pages.splice(nextIndex, 0, page); currentDocument.selectedPageIndex = nextIndex; markCurrentDirty(); renderStandalone(); }); }
function removeSelectedPdfPage() { withPdfDocument(() => { if (currentDocument.pages.length <= 1) return setError("A PDF must keep at least one page."); currentDocument.pages.splice(currentDocument.selectedPageIndex, 1); currentDocument.selectedPageIndex = Math.max(0, currentDocument.selectedPageIndex - 1); markCurrentDirty(); renderStandalone(); }); }

function renderSummary() {
  if (!currentDocument) return;
  if (currentDocument.kind === "zip") {
    const editableCount = currentDocument.entries.filter((entry) => entry.editable).length;
    const dirtyCount = currentDocument.entries.filter((entry) => entry.dirty).length;
    elements.summaryPrimary.textContent = currentDocument.entries.length + " archive items";
    elements.summarySecondary.textContent = editableCount + " editable, " + dirtyCount + " changed";
  } else {
    elements.summaryPrimary.textContent = formatBytes(currentDocument.bytes.length);
    elements.summarySecondary.textContent = currentDocument.mode + (currentDocument.dirty ? ", unsaved changes ready to export" : ", no edits yet");
  }
}

function selectPdfPage(index) {
  currentDocument.selectedPageIndex = index;
  renderPdfPageList(currentDocument, elements, selectPdfPage);
  renderPdfPage(currentDocument, elements);
}

function refreshPdfAfterEdit() {
  markCurrentDirty();
  renderPdfPageList(currentDocument, elements, selectPdfPage);
  renderPdfPage(currentDocument, elements);
}

function hideStandaloneModes() { elements.textEditor.hidden = true; elements.hexEditor.hidden = true; elements.pdfViewer.hidden = true; elements.imageViewer.hidden = true; elements.videoViewer.hidden = true; elements.fallbackPanel.hidden = true; elements.pdfToolbar.hidden = true; elements.mediaToolbar.hidden = true; }
function setLoading(isLoading) { elements.uploadLabel.textContent = isLoading ? "Loading file..." : "Choose file"; }
function setError(message) { elements.errorBanner.hidden = !message; elements.errorBanner.textContent = message || ""; }
function withStandaloneMode(mode) { return currentDocument && currentDocument.kind === "standalone" && currentDocument.mode === mode; }
function withPdfDocument(fn) { if (withStandaloneMode("pdf")) fn(); }
function markCurrentDirty() { currentDocument.dirty = true; renderSummary(); }
function releaseCurrentResources() { if (currentDocument && currentDocument.kind === "standalone" && currentDocument.objectUrl) URL.revokeObjectURL(currentDocument.objectUrl); }
