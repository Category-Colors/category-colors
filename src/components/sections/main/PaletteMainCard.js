import { Box } from "@chakra-ui/react";
import { Flex } from "@chakra-ui/react";
import PaletteColors from "./PaletteColors";
import PaletteCopyButton from "./PaletteCopyButton";
import PaletteHeader from "./PaletteHeader";

function PaletteMainCard() {
  return (
    <Box gridArea="main" h={"100%"} p={4} overflow={"scroll"} mt={4}>
      <Flex>
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
