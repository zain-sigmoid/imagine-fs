import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { Link } from "react-router";

const Wrong = () => {
  const { wrong } = useParams();
  const navigate = useNavigate();
  const [pageExist, setPageExist] = useState(true);
  const [seconds, setSeconds] = useState(10);
  const pages = ["about"];
  console.log(pageExist);

  useEffect(() => {
    if (!pages.includes(wrong)) {
      setPageExist(false);

      // start countdown
      const interval = setInterval(() => {
        setSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            navigate("/");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // cleanup on unmount
      return () => clearInterval(interval);
    }
  }, [wrong, navigate, pages]);

  return (
    <div className="container p-4">
      <div className="d-flex justify-content-center align-items-center">
        <div className="shadow rounded p-4 text-center">
          {!pageExist ? (
            <div className="d-flex justify-content-center align-items-center flex-column mt-5">
              <img
                src={new URL("../assets/notfound.webp", import.meta.url).href}
                alt="not found"
                style={{ maxHeight: "300px" }}
                className="img-fluid"
              />
              <h4 className="text-center">
                The page you are looking , does not found
              </h4>
              <div>
                <p>Page does not exist</p>
                <Link to={"/"}>Go To Home</Link>
                <p>
                  Redirecting to home in{" "}
                  <span className="fs-4 text-primary">{seconds}</span> sec...
                </p>
              </div>
            </div>
          ) : (
            <p>Valid page: {wrong}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Wrong;
