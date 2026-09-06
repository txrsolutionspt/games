import { categoriesFor } from "../objects/object-model.js?v=2026-08-26.29";
import { getCurrentMapId, addAttachmentMeta, removeAttachmentMeta } from "../objects/object-store.js?v=2026-08-26.29";
import { addFile, deleteFile, getFileBlob, isImageType } from "../persistence/attachments.js?v=2026-08-26.29";

const editorOverlay = document.getElementById("editor-overlay");
const editorForm = document.getElementById("editor-form");
const editorTitle = document.getElementById("editor-title");
const editorName = document.getElementById("editor-name");
const editorCategoryGrid = document.getElementById("editor-category-grid");
const editorColorSwatches = document.getElementById("editor-color-swatches");
const editorDescription = document.getElementById("editor-description");
const editorFileList = document.getElementById("editor-file-list");
const editorFileAdd = document.getElementById("editor-file-add");
const editorFileInput = document.getElementById("editor-file-input");
const editorCancel = document.getElementById("editor-cancel");

const confirmOverlay = document.getElementById("confirm-overlay");
const confirmMessage = document.getElementById("confirm-message");
const confirmCancel = document.getElementById("confirm-cancel");
const confirmDelete = document.getElementById("confirm-delete");

const GEOMETRY_LABEL = {
  Point: "Point",
  LineString: "Line",
  Polygon: "Area",
};

// A custom color overrides the geometry type's own default marker/line/fill
// color on the map (see map-layers.js) — the icon itself still comes from
// the category, this only recolors the shape.
const COLOR_SWATCHES = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
];

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function openEditorDialog(geometryType, { isNew, properties }) {
  return new Promise((resolve) => {
    editorTitle.textContent = `${isNew ? "New" : "Edit"} ${GEOMETRY_LABEL[geometryType] || "Object"}`;
    editorName.value = properties.name || "";
    editorDescription.value = properties.description || "";

    const categories = categoriesFor(geometryType);
    let selectedCategory = properties.category || categories[0]?.value || "";

    editorCategoryGrid.innerHTML = "";
    for (const option of categories) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "category-option";
      button.dataset.category = option.value;
      button.classList.toggle("selected", option.value === selectedCategory);
      button.innerHTML = `
        <span class="category-icon">${option.icon || ""}</span>
        <span class="category-label">${option.label}</span>
      `;
      button.addEventListener("click", () => {
        selectedCategory = option.value;
        for (const sibling of editorCategoryGrid.children) {
          sibling.classList.toggle("selected", sibling === button);
        }
      });
      editorCategoryGrid.appendChild(button);
    }

    let selectedColor = properties.color || null;

    editorColorSwatches.innerHTML = "";
    const defaultSwatch = document.createElement("button");
    defaultSwatch.type = "button";
    defaultSwatch.className = "color-swatch color-swatch-default";
    defaultSwatch.title = "Default color";
    defaultSwatch.setAttribute("aria-label", "Default color");
    defaultSwatch.classList.toggle("selected", selectedColor === null);
    defaultSwatch.addEventListener("click", () => {
      selectedColor = null;
      for (const sibling of editorColorSwatches.children) {
        sibling.classList.toggle("selected", sibling === defaultSwatch);
      }
    });
    editorColorSwatches.appendChild(defaultSwatch);

    for (const color of COLOR_SWATCHES) {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "color-swatch";
      swatch.style.background = color;
      swatch.title = color;
      swatch.setAttribute("aria-label", `Color ${color}`);
      swatch.classList.toggle("selected", color === selectedColor);
      swatch.addEventListener("click", () => {
        selectedColor = color;
        for (const sibling of editorColorSwatches.children) {
          sibling.classList.toggle("selected", sibling === swatch);
        }
      });
      editorColorSwatches.appendChild(swatch);
    }

    // A brand-new object doesn't exist in the store yet (it's only added on
    // Save), so attachment metadata is tracked locally here and merged into
    // the feature's own properties.attachments on save; an existing object
    // is updated through the store immediately, same as any other edit.
    if (!Array.isArray(properties.attachments)) {
      properties.attachments = [];
    }
    let objectUrls = [];

    function revokeObjectUrls() {
      for (const url of objectUrls) URL.revokeObjectURL(url);
      objectUrls = [];
    }

    function renderFileList() {
      revokeObjectUrls();
      editorFileList.innerHTML = "";

      for (const attachment of properties.attachments) {
        const item = document.createElement("div");
        item.className = "file-item";

        const thumb = document.createElement("span");
        thumb.className = "file-thumb";
        thumb.textContent = "📄";
        item.appendChild(thumb);

        if (isImageType(attachment.type)) {
          getFileBlob(attachment.id).then((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            objectUrls.push(url);
            thumb.textContent = "";
            thumb.classList.add("file-thumb-image");
            thumb.style.backgroundImage = `url("${url}")`;
          }).catch(() => {});
        }

        const info = document.createElement("span");
        info.className = "file-info";
        info.innerHTML = `
          <span class="file-name">${escapeHtml(attachment.name)}</span>
          <span class="file-size">${formatFileSize(attachment.size)}</span>
        `;
        item.appendChild(info);

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "file-remove";
        removeButton.setAttribute("aria-label", "Remove file");
        removeButton.textContent = "✕";
        removeButton.addEventListener("click", async () => {
          await deleteFile(attachment.id).catch(() => {});
          properties.attachments = properties.attachments.filter((entry) => entry.id !== attachment.id);
          if (!isNew) removeAttachmentMeta(properties.id, attachment.id);
          renderFileList();
        });
        item.appendChild(removeButton);

        editorFileList.appendChild(item);
      }
    }

    async function onFilesChosen() {
      const files = [...editorFileInput.files];
      editorFileInput.value = "";

      for (const file of files) {
        try {
          const meta = await addFile(getCurrentMapId(), properties.id, file);
          properties.attachments = [...properties.attachments, meta];
          if (!isNew) addAttachmentMeta(properties.id, meta);
        } catch (error) {
          alert(error.message || "Couldn't add that file.");
        }
      }

      renderFileList();
    }

    renderFileList();

    editorOverlay.classList.remove("hidden");
    editorName.focus();

    function cleanup() {
      editorOverlay.classList.add("hidden");
      revokeObjectUrls();
      editorForm.removeEventListener("submit", onSubmit);
      editorCancel.removeEventListener("click", onCancel);
      editorFileAdd.removeEventListener("click", onAddFileClick);
      editorFileInput.removeEventListener("change", onFilesChosen);
    }

    function onAddFileClick() {
      editorFileInput.click();
    }

    function onSubmit(event) {
      event.preventDefault();
      cleanup();
      resolve({
        name: editorName.value.trim(),
        category: selectedCategory,
        description: editorDescription.value.trim(),
        color: selectedColor,
      });
    }

    function onCancel() {
      cleanup();
      // A discarded new object never enters the store, so any files added
      // to it during this session would otherwise be orphaned forever.
      // Edits to an existing object's attachments are already committed
      // immediately (see above) and are left as-is.
      if (isNew) {
        for (const attachment of properties.attachments) {
          deleteFile(attachment.id).catch(() => {});
        }
      }
      resolve(null);
    }

    editorForm.addEventListener("submit", onSubmit);
    editorCancel.addEventListener("click", onCancel);
    editorFileAdd.addEventListener("click", onAddFileClick);
    editorFileInput.addEventListener("change", onFilesChosen);
  });
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

export function openConfirmDialog(message) {
  return new Promise((resolve) => {
    confirmMessage.textContent = message;
    confirmOverlay.classList.remove("hidden");

    function cleanup() {
      confirmOverlay.classList.add("hidden");
      confirmDelete.removeEventListener("click", onConfirm);
      confirmCancel.removeEventListener("click", onCancel);
    }

    function onConfirm() {
      cleanup();
      resolve(true);
    }

    function onCancel() {
      cleanup();
      resolve(false);
    }

    confirmDelete.addEventListener("click", onConfirm);
    confirmCancel.addEventListener("click", onCancel);
  });
}
