import { categoriesFor } from "../objects/object-model.js?v=2026-08-26.17";

const editorOverlay = document.getElementById("editor-overlay");
const editorForm = document.getElementById("editor-form");
const editorTitle = document.getElementById("editor-title");
const editorName = document.getElementById("editor-name");
const editorCategoryGrid = document.getElementById("editor-category-grid");
const editorDescription = document.getElementById("editor-description");
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

    editorOverlay.classList.remove("hidden");
    editorName.focus();

    function cleanup() {
      editorOverlay.classList.add("hidden");
      editorForm.removeEventListener("submit", onSubmit);
      editorCancel.removeEventListener("click", onCancel);
    }

    function onSubmit(event) {
      event.preventDefault();
      cleanup();
      resolve({
        name: editorName.value.trim(),
        category: selectedCategory,
        description: editorDescription.value.trim(),
      });
    }

    function onCancel() {
      cleanup();
      resolve(null);
    }

    editorForm.addEventListener("submit", onSubmit);
    editorCancel.addEventListener("click", onCancel);
  });
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
