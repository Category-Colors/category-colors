import { Box, Flex } from "@chakra-ui/react";
import PaletteColors from "./PaletteColors";
import PaletteCopyButton from "./PaletteCopyButton";
import PaletteHeader from "./PaletteHeader";

function PaletteMainCard() {
  const data = [1, 2, 3];

  return (
    <Box gridArea="main" h={"100%"} p={4} overflow={"scroll"} mt={4}>
      {data.map((id) => (
        <Flex key={id}>
          {/* Palette Header with date and id # */}
          <PaletteHeader id={id} />
          {/* Palette Color Circle Buttons */}
          <PaletteColors id={id} />
          {/* Palette Copy Button to copy hex values to clipboard */}
          <PaletteCopyButton id={id} />
        </Flex>
      ))}
    </Box>
  );
}

export default PaletteMainCard;
