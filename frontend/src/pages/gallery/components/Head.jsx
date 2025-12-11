import React from "react";
import "../styling/head.css";

const Head = () => {
  const enhancement = "low";
  const moodChips = [
    { label: "palette", icon: "fa-palette" },
    { label: "pattern", icon: "fa-grip-lines" },
    { label: "motif", icon: "fa-star" },
    { label: "style", icon: "fa-wand-magic-sparkles" },
    { label: "finish", icon: "fa-spray-can-sparkles" },
  ];
  return (
    <header
      className="app-header sticky-top moodboard-canvas"
      style={{ padding: "10px 20px", opacity: 0.85 }}
    >
      <div className="container-fluid px-3 py-2">
        <div className="row align-items-center">
          <div className="col-md-12 text-center">
            <div className="mb-4 header-hero">
              {/* text wrapper with higher z-index */}
              <div className="header-hero-content">
                <span className="fs-4 fw-semibold mb-2 text-white d-block">
                  Imagine Luma Gallery
                </span>
                <p className="text-dark mb-0">
                  Craft themed serviettes with curated palettes, motifs, and
                  finishes. Fine-tune details, compare enhancements, and export
                  in a click.
                </p>
              </div>

              {/* orbs stay after, but with lower z-index */}
              <div className="floating-orb orb-one"></div>
              <div className="floating-orb orb-two"></div>
              <div className="floating-orb orb-three"></div>
            </div>
          </div>
          <div className="d-flex justify-content-center">
            <div className="d-flex flex-wrap gap-2">
              {moodChips.map((chip) => (
                <div
                  key={chip.label}
                  className="badge mood-chip d-flex align-items-center gap-2"
                >
                  <i className={`fa-solid ${chip.icon}`}></i>
                  <span>{chip.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Head;
