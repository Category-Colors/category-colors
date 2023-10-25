import React from "react";
import { Button } from "@chakra-ui/react";
import { CopyIcon } from "@chakra-ui/icons";

function PaletteCopyButton() {
  return (
    <Button
      size="sm"
      variant="outline"
      colorScheme="gray"
      leftIcon={<CopyIcon />}
    >
      Copy hex values
    </Button>
  );
}

export default PaletteCopyButton;
