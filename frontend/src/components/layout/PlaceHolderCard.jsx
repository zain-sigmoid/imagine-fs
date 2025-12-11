import React from "react";

const PlaceHolderCard = () => {
  return (
    <div class="card" aria-hidden="true">
      <div
        class="card-img-top bg-secondary bg-opacity-75"
        alt="..."
        style={{ objectFit: "cover", height: "220px" }}
      ></div>
      <div class="card-body">
        <h5 class="card-title placeholder-glow">
          <span class="placeholder col-6"></span>
        </h5>
        <p class="card-text placeholder-glow">
          <span class="placeholder col-7"></span>
          <span class="placeholder col-4"></span>
          <span class="placeholder col-4"></span>
          <span class="placeholder col-6"></span>
          <span class="placeholder col-8"></span>
        </p>
      </div>
    </div>
  );
};

export default PlaceHolderCard;
