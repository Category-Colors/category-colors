import { Box } from "@chakra-ui/react";
import { Heading } from "@chakra-ui/react";

function PaletteMainCard() {
  return (
    <Box gridArea="main" bg="white.500" borderLeft={"1px solid gray"} p={4}>
      <Heading size="md">Palette #200123</Heading>
    </Box>
  );
}

export default PaletteMainCard;
