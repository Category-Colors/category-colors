import React from "react";
import { Button, useClipboard } from "@chakra-ui/react";
import { CopyIcon } from "@chakra-ui/icons";
import chipColorsData from "../../../utils/chipColorsDummyData";

function PaletteCopyButton({ id }) {
  const [hexValues, setHexValues] = React.useState("");
  const { hasCopied, onCopy } = useClipboard(hexValues);

  React.useEffect(() => {
    const newPalette = chipColorsData.find((item) => item.id === id);

    if (newPalette) {
      setHexValues(newPalette.color.join(", "));
    }
  }, [id]);

  return (
    <>
      <Button
        onClick={onCopy}
        size="sm"
        mt={4}
        variant="outline"
        colorScheme="gray"
        leftIcon={<CopyIcon />}
      >
        {hasCopied ? `copied palette #${id}` : "Copy hex values"}
      </Button>
    </>
  );
}

export default PaletteCopyButton;
