function RecentImages({
  recentImages,
  onUseImage,
  onDeleteImage,
  loading,
  relatedImages,
}) {
  // console.log("Rendering recent image item:", recentImages);
  return (
    <div className="section-card p-4 mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h5 text-dark mb-0">
          <i className="fa-solid fa-clock-rotate-left me-2 text-primary"></i>
          Recent Images
        </h2>
        <span className="badge text-bg-light text-dark">
          {recentImages.length}
        </span>
      </div>
      <div style={{ maxHeight: "425px", overflowY: "auto" }}>
        {recentImages.length === 0 ? (
          <p className="text-muted small mb-0">
            Your latest generations will appear here for quick re-use. Run a
            concept to begin the gallery.
          </p>
        ) : (
          <ul className="list-group list-group-flush">
            {recentImages.map((item) => {
              const identifier = item.id;
              const image = item?.variants?.original || {};
              return (
                <li
                  className="list-group-item px-0 d-flex align-items-center gap-3"
                  key={identifier}
                >
                  <div className="flex-shrink-0">
                    {image.data_b64 ? (
                      <img
                        // src={item.thumbnail || item.url}
                        src={`data:${image.mime_type};base64,${image.data_b64}`}
                        alt={image.name || "Previous design"}
                        className="rounded-3 border"
                        width="64"
                        height="64"
                      />
                    ) : (
                      <div className="rounded-3 border bg-light d-flex align-items-center justify-content-center text-muted">
                        <i className="fa-regular fa-image px-3 py-2"></i>
                      </div>
                    )}
                  </div>
                  <div className="flex-grow-1">
                    {item?.name?.map((label) => (
                      <span
                        key={label}
                        className="badge text-bg-light fw-normal me-1 mb-1 border border-success"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  <div className="d-flex align-self-start">
                    <div className="dropdown ms-auto">
                      <button
                        type="button"
                        className="btn btn-sm btn-default"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                        disabled={loading}
                      >
                        <i className="fa-solid fa-ellipsis-vertical"></i>
                      </button>

                      <ul className="dropdown-menu dropdown-menu-end">
                        <li style={{ fontSize: "14px" }}>
                          <button
                            className="dropdown-item"
                            type="button"
                            onClick={() => onUseImage(item)}
                            disabled={loading}
                          >
                            <i className="fa-solid fa-rotate me-2"></i>
                            Use
                          </button>
                        </li>
                        <li style={{ fontSize: "14px" }}>
                          <button
                            className="dropdown-item text-danger"
                            type="button"
                            onClick={() => onDeleteImage(identifier)}
                            disabled={loading}
                          >
                            <i className="fa-solid fa-trash me-2"></i>
                            Delete
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {relatedImages && relatedImages.length > 0 && (
        <>
          <hr className="my-4" />
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="h5 text-dark mb-0">
              <i className="fa-solid fa-images me-2 text-primary"></i>
              Related Images
            </h2>
            <span className="badge text-bg-light text-dark">
              {relatedImages.length}
            </span>
          </div>
          <div
            style={{
              maxHeight: "325px",
              overflowY: "auto",
            }}
          >
            <ul className="list-group list-group-flush">
              {relatedImages.map((item) => {
                const identifier = item.id;
                const image = item?.variants?.original || {};
                return (
                  <li
                    className="list-group-item px-0 d-flex align-items-center gap-3"
                    key={identifier}
                  >
                    <div className="flex-shrink-0">
                      {image.data_b64 ? (
                        <img
                          src={`data:${image.mime_type};base64,${image.data_b64}`}
                          alt={item.filename || "Related design"}
                          className="rounded-3 border"
                          width="64"
                          height="64"
                        />
                      ) : (
                        <div className="rounded-3 border bg-light d-flex align-items-center justify-content-center text-muted">
                          <i className="fa-regular fa-image px-3 py-2"></i>
                        </div>
                      )}
                    </div>
                    <div className="flex-grow-1">
                      {item?.name?.map((label) => (
                        <span
                          key={label}
                          className="badge text-bg-light fw-normal me-1 mb-1 border border-info"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                    <div className="d-flex align-self-start">
                      <div className="dropdown ms-auto">
                        <button
                          type="button"
                          className="btn btn-sm btn-default"
                          data-bs-toggle="dropdown"
                          aria-expanded="false"
                          disabled={loading}
                        >
                          <i className="fa-solid fa-ellipsis-vertical"></i>
                        </button>

                        <ul className="dropdown-menu dropdown-menu-end">
                          <li style={{ fontSize: "14px" }}>
                            <button
                              className="dropdown-item"
                              type="button"
                              onClick={() => onUseImage(item)}
                              disabled={loading}
                            >
                              <i className="fa-solid fa-rotate me-2"></i>
                              Use
                            </button>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

export function EditPanel({
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
}) {
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
    <div className="section-card p-4">
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
}

function Sidebar(props) {
  return (
    <aside>
      <RecentImages {...props} />
      {/* <EditPanel {...props} /> */}
    </aside>
  );
}

export default Sidebar;
