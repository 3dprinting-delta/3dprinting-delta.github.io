let pdfDraftAnnotation = null;

async function hydratePdfDocument(document) {
  document.objectUrl = URL.createObjectURL(new Blob([document.bytes], { type: "application/pdf" }));
  document.pdfjsDocument = await pdfjsLib.getDocument({ data: document.bytes }).promise;
  document.pages = Array.from({ length: document.pdfjsDocument.numPages }, (_, originalIndex) => ({
    originalIndex,
    rotation: 0,
    annotations: []
  }));
  document.selectedPageIndex = 0;
  document.activeTool = "highlight";
}

function setPdfTool(document, elements, tool) {
  if (!document || document.kind !== "standalone" || document.mode !== "pdf") return;
  document.activeTool = tool;
  elements.modeBadge.textContent = "pdf/" + tool;
}

function renderPdfPageList(document, elements, onSelect) {
  elements.pdfPageList.innerHTML = "";
  elements.pdfSidebarMeta.textContent = document.pages.length + " pages. Changes export into a rebuilt PDF.";
  document.pages.forEach((pageInfo, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pdf-page-chip" + (index === document.selectedPageIndex ? " is-active" : "");
    const title = document.createElement("strong");
    title.textContent = "Page " + (index + 1);
    const meta = document.createElement("span");
    meta.textContent = "Source " + (pageInfo.originalIndex + 1) + ", rotation " + pageInfo.rotation + " deg, " + pageInfo.annotations.length + " annotations";
    button.appendChild(title);
    button.appendChild(meta);
    button.addEventListener("click", () => onSelect(index));
    elements.pdfPageList.appendChild(button);
  });
}

async function renderPdfPage(document, elements) {
  const selected = document.pages[document.selectedPageIndex];
  if (!selected) {
    elements.pdfStageEmpty.hidden = false;
    elements.pdfPageFrame.hidden = true;
    return;
  }
  const pdfPage = await document.pdfjsDocument.getPage(selected.originalIndex + 1);
  const viewport = pdfPage.getViewport({ scale: PDF_PREVIEW_SCALE, rotation: selected.rotation });
  const context = elements.pdfCanvas.getContext("2d");
  elements.pdfCanvas.width = Math.ceil(viewport.width);
  elements.pdfCanvas.height = Math.ceil(viewport.height);
  await pdfPage.render({ canvasContext: context, viewport }).promise;
  elements.pdfPageTitle.textContent = "Page " + (document.selectedPageIndex + 1);
  elements.pdfPageMeta.textContent = "Original page " + (selected.originalIndex + 1) + ", rotation " + selected.rotation + " deg, " + selected.annotations.length + " annotations";
  elements.pdfAnnotationLayer.style.width = viewport.width + "px";
  elements.pdfAnnotationLayer.style.height = viewport.height + "px";
  elements.pdfStageEmpty.hidden = true;
  elements.pdfPageFrame.hidden = false;
  renderPdfAnnotations(document, elements);
}

function renderPdfAnnotations(document, elements) {
  elements.pdfAnnotationLayer.innerHTML = "";
  const selected = document.pages[document.selectedPageIndex];
  if (!selected) return;
  for (const annotation of selected.annotations) {
    const node = document.createElement("div");
    node.className = "pdf-annotation " + (annotation.type === "highlight" ? "is-highlight" : "is-note");
    node.style.left = annotation.x * 100 + "%";
    node.style.top = annotation.y * 100 + "%";
    if (annotation.type === "highlight") {
      node.style.width = annotation.width * 100 + "%";
      node.style.height = annotation.height * 100 + "%";
      node.title = annotation.comment || "Highlight";
    } else {
      node.style.transform = "translate(-50%, -50%)";
      node.textContent = "i";
      node.title = annotation.comment || "Note";
    }
    elements.pdfAnnotationLayer.appendChild(node);
  }
  if (pdfDraftAnnotation) {
    const draft = document.createElement("div");
    draft.className = "pdf-annotation is-draft";
    draft.style.left = pdfDraftAnnotation.x * 100 + "%";
    draft.style.top = pdfDraftAnnotation.y * 100 + "%";
    draft.style.width = pdfDraftAnnotation.width * 100 + "%";
    draft.style.height = pdfDraftAnnotation.height * 100 + "%";
    elements.pdfAnnotationLayer.appendChild(draft);
  }
}

function getRelativePdfPoint(event, elements) {
  const rect = elements.pdfAnnotationLayer.getBoundingClientRect();
  return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) };
}

function beginPdfAnnotation(document, elements, event, markDirty) {
  const selected = document.pages[document.selectedPageIndex];
  if (!selected) return;
  const point = getRelativePdfPoint(event, elements);
  if (document.activeTool === "note") {
    const comment = window.prompt("Note text");
    if (!comment) return;
    selected.annotations.push({ type: "note", x: point.x, y: point.y, comment });
    markDirty();
    renderPdfAnnotations(document, elements);
    return;
  }
  pdfDraftAnnotation = { startX: point.x, startY: point.y, x: point.x, y: point.y, width: 0, height: 0 };
}

function updatePdfAnnotation(document, elements, event) {
  if (!pdfDraftAnnotation) return;
  const point = getRelativePdfPoint(event, elements);
  pdfDraftAnnotation.x = Math.min(pdfDraftAnnotation.startX, point.x);
  pdfDraftAnnotation.y = Math.min(pdfDraftAnnotation.startY, point.y);
  pdfDraftAnnotation.width = Math.abs(point.x - pdfDraftAnnotation.startX);
  pdfDraftAnnotation.height = Math.abs(point.y - pdfDraftAnnotation.startY);
  renderPdfAnnotations(document, elements);
}

function finishPdfAnnotation(document, elements, markDirty) {
  if (!pdfDraftAnnotation) return;
  const selected = document.pages[document.selectedPageIndex];
  if (selected && pdfDraftAnnotation.width > 0.01 && pdfDraftAnnotation.height > 0.01) {
    selected.annotations.push({ type: "highlight", x: pdfDraftAnnotation.x, y: pdfDraftAnnotation.y, width: pdfDraftAnnotation.width, height: pdfDraftAnnotation.height, comment: "" });
    markDirty();
  }
  pdfDraftAnnotation = null;
  renderPdfAnnotations(document, elements);
}

function cancelDraftAnnotation(document, elements) {
  if (!pdfDraftAnnotation) return;
  pdfDraftAnnotation = null;
  renderPdfAnnotations(document, elements);
}

async function exportPdf(document) {
  const pdfDoc = await PDFLib.PDFDocument.load(document.bytes);
  const output = await PDFLib.PDFDocument.create();
  for (const pageInfo of document.pages) {
    const [copiedPage] = await output.copyPages(pdfDoc, [pageInfo.originalIndex]);
    copiedPage.setRotation(PDFLib.degrees(pageInfo.rotation));
    const width = copiedPage.getWidth();
    const height = copiedPage.getHeight();
    for (const annotation of pageInfo.annotations) {
      if (annotation.type === "highlight") {
        copiedPage.drawRectangle({ x: annotation.x * width, y: height - (annotation.y + annotation.height) * height, width: annotation.width * width, height: annotation.height * height, color: PDFLib.rgb(1, 0.84, 0.3), opacity: 0.35, borderColor: PDFLib.rgb(0.95, 0.72, 0.12), borderWidth: 1 });
      } else {
        copiedPage.drawCircle({ x: annotation.x * width, y: height - annotation.y * height, size: 12, color: PDFLib.rgb(0.16, 0.62, 0.56), opacity: 0.95 });
        copiedPage.drawText("i", { x: annotation.x * width - 2, y: height - annotation.y * height - 4, size: 12, color: PDFLib.rgb(0.03, 0.07, 0.1) });
        if (annotation.comment) copiedPage.drawText(annotation.comment, { x: Math.min(annotation.x * width + 16, width - 180), y: Math.max(height - annotation.y * height - 6, 20), size: 10, maxWidth: 160, color: PDFLib.rgb(0.12, 0.16, 0.22) });
      }
    }
    output.addPage(copiedPage);
  }
  return await output.save();
}
