import { Box } from "@chakra-ui/react";
import { Heading } from "@chakra-ui/react";

function LeftUpperCard() {
  return (
    <Box gridArea="leftUpperCard" borderBottom={"1px solid gray"} p={4}>
      <Heading size="md"> Palette Parameters </Heading>
    </Box>
  );
}

export default LeftUpperCard;
