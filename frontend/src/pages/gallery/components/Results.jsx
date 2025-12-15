import React from "react";
import ResultCard from "./ResultCard";

const Results = ({
  imageSets,
  selectedComboIndex,
  onSelectedComboChange,
  activeVariant,
  onVariantChange,
  loading,
  downloadImage,
  editPrompt,
}) => {
  if (!imageSets.length) {
    return (
      <section className="section-card px-5 py-4 text-center text-muted h-100 shadow-sm">
        <h2 className="h5 text-dark mb-3">
          <i className="fa-solid fa-wand-sparkles me-2 text-primary"></i>
          Ready when you are
        </h2>
        <p className="mb-0">
          Choose a theme and tap <strong>Generate Concepts</strong> to see
          tailored designs with enhancement previews.
        </p>
      </section>
    );
  }
  return (
    <article className={`section-card p-4 mb-4 shadow-sm border-2`}>
      <section aria-live="polite">
        <nav className="mb-3">
          <div className="nav nav-tabs">
            {imageSets.map((_, idx) => (
              <button
                type="button"
                key={idx}
                className={`nav-link ${
                  idx === selectedComboIndex ? "active" : ""
                }`}
                onClick={() => onSelectedComboChange(idx)}
              >
                Image {idx + 1}
              </button>
            ))}
          </div>
        </nav>
        {imageSets.map((imageSet, index) =>
          index === selectedComboIndex ? (
            <ResultCard
              key={index}
              imageSet={imageSet}
              index={index}
              isActive={true}
              onActivate={onSelectedComboChange}
              activeVariant={activeVariant[index]}
              onVariantChange={onVariantChange}
              downloadImage={downloadImage}
              editPrompt={editPrompt}
            />
          ) : null
        )}
        {loading && (
          <div className="text-center text-muted my-4">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="small mt-2 mb-0">Processing your request…</p>
          </div>
        )}
      </section>
    </article>
  );
};

export default Results;
