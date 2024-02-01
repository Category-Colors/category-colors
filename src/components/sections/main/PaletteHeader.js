import React from "react";
import { Box } from "@chakra-ui/react";
import { Heading, Text } from "@chakra-ui/react";

function PaletteHeader({ id }) {
  return (
    <Box flex="2">
      <Heading size="lg">Palette {id} </Heading>

      <Text fontSize={14} sx={{ lineHeight: "21px" }} color="gray">
        Generated June 7, 2023 at 5:42pm
      </Text>
    </Box>
  );
}

export default PaletteHeader;
