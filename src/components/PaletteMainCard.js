import { Box } from "@chakra-ui/react";
import { Flex } from "@chakra-ui/react";
import PaletteColors from "./PaletteColors";
import PaletteCopyButton from "./PaletteCopyButton";
import PaletteHeader from "./PaletteHeader";

function PaletteMainCard() {
  return (
    <Box gridArea="main" borderLeft={"1px solid gray"} p={4}>
      <Flex color="#000000">
        {/* Palette Header with date and id # */}
        <PaletteHeader />
        {/* Palette Color Circle Buttons */}
        <PaletteColors />
        {/* Palette Copy Button to copy hex values to clipboard */}
        <PaletteCopyButton />
      </Flex>
    </Box>
  );
}

export default PaletteMainCard;
