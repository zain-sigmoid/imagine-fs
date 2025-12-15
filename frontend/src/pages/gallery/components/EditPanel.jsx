import React from "react";

const EditPanel = ({
  imageSets,
  selectedComboIndex,
  onComboChange,
  editPrompt,
  onEditPromptChange,
  onEditSubmit,
  activeVariant,
  onVariantChange,
  loading,
  editRef,
}) => {
  const options = imageSets.map((set, index) => {
    const combo = set.combo || {};
    const labelParts = [combo.motif, combo.pattern]
      .filter(Boolean)
      .map((part) => String(part).replace("Default", "").trim())
      .filter(Boolean);
    const label = labelParts.length
      ? `Image ${index + 1}`
      : `Image ${index + 1}`;
    return {
      value: index,
      label,
    };
  });

  const variants = [
    { key: "original", label: "Original" },
    { key: "low", label: "Low" },
    { key: "medium", label: "Medium" },
    { key: "high", label: "High" },
  ];

  if (imageSets[selectedComboIndex]?.edited) {
    variants.push({ key: "edited", label: "Edited" });
  }
  return (
    <div className="section-card shadow-sm p-4">
      <h2 className="h5 text-dark mb-3">
        <i className="fa-solid fa-pen-clip me-2 text-primary"></i>
        Quick Edit
      </h2>
      {imageSets.length === 0 ? (
        <p className="text-muted small mb-0">
          Generate or load a concept to unlock guided editing tools. You can
          refine colour, motif, or finishing touches with a simple prompt.
        </p>
      ) : (
        <>
          <div className="mb-3">
            <label className="form-label text-uppercase small text-muted fw-semibold">
              Choose combination
            </label>
            <select
              className="form-select"
              value={selectedComboIndex}
              onChange={(event) => onComboChange(Number(event.target.value))}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label text-uppercase small text-muted fw-semibold">
              Base variant
            </label>
            <div className="d-flex flex-wrap gap-2">
              {variants.map((variant) => (
                <button
                  type="button"
                  key={variant.key}
                  className={`btn btn-sm ${
                    (activeVariant[selectedComboIndex] || "original") ===
                    variant.key
                      ? "btn-primary"
                      : "btn-outline-primary"
                  }`}
                  onClick={() =>
                    onVariantChange(selectedComboIndex, variant.key)
                  }
                >
                  {variant.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label text-uppercase small text-muted fw-semibold">
              Edit prompt
              <i className="fa-solid fa-star fa-2xs text-danger ms-1"></i>
            </label>
            <textarea
              className="form-control"
              rows="3"
              value={editPrompt}
              onChange={(event) => {
                onEditPromptChange(event.target.value);
                editRef.current = event.target.value;
              }}
              placeholder="E.g. brighten the background, add gold foil monogram on the centre, soften the stripes."
            ></textarea>
          </div>

          <button
            type="button"
            className="btn btn-success w-100 btn-icon"
            onClick={onEditSubmit}
            disabled={loading || editPrompt === ""}
          >
            <i className="fa-solid fa-wand-magic"></i>
            {loading ? "Applying…" : "Apply Edit"}
          </button>
        </>
      )}
    </div>
  );
};

export default EditPanel;
