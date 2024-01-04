import React from "react";
import { Button } from "@chakra-ui/react";
import { CopyIcon } from "@chakra-ui/icons";

async function copyToClipboard() {
  const headerHexText = document.querySelector(".headerHexText").textContent;

  try {
    await navigator.clipboard.writeText(headerHexText);
    document.querySelector(".tooltipText").style.display = "block";

    setTimeout(() => {
      document.querySelector(".tooltipText").style.display = "none";
    }, 30000);
  } catch (err) {
    throw new Error("Failed to copy: ", err);
  }
}

function PaletteCopyButton() {
  return (
    <>
      <Button
        onClick={copyToClipboard}
        size="sm"
        mt={4}
        variant="outline"
        colorScheme="gray"
        leftIcon={<CopyIcon />}
      >
        Copy hex values
      </Button>
      <span
        className="tooltipText"
        style={{
          display: "none",
          color: "red",
          position: "absolute",
          right: "1%",
          top: "18%",
        }}
      >
        Hex Values Copied!
      </span>
    </>
  );
}

export default PaletteCopyButton;
