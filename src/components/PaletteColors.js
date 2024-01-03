import React from "react";
import { Box, IconButton, Text } from "@chakra-ui/react";

function PaletteColors() {
  return (
    <Box
      flex="5"
      display="flex"
      justifyContent={"flex-start"}
      alignItems={"center"}
      color={"#000000"}
    >
      <IconButton
        isRound={true}
        variant="solid"
        background="#054849"
        aria-label="Done"
        fontSize="20px"
        marginLeft="8px"
      />
      <IconButton
        isRound={true}
        variant="solid"
        background="#8ef08a"
        aria-label="Done"
        fontSize="20px"
        marginLeft="8px"
      />
      <IconButton
        isRound={true}
        variant="solid"
        background="#0081ec"
        aria-label="Done"
        fontSize="20px"
        marginLeft="8px"
      />
      <IconButton
        isRound={true}
        variant="solid"
        background="#f9c2f5"
        aria-label="Done"
        fontSize="20px"
        marginLeft="8px"
      />
      <IconButton
        isRound={true}
        variant="solid"
        background="#0ae2ff"
        aria-label="Done"
        fontSize="20px"
        marginLeft="8px"
      />
      <IconButton
        isRound={true}
        variant="solid"
        background="#f5be01"
        aria-label="Done"
        fontSize="20px"
        marginLeft="8px"
      />
      <IconButton
        isRound={true}
        variant="solid"
        background="#ff6c37"
        aria-label="Done"
        fontSize="20px"
        marginLeft="8px"
      />
      <IconButton
        isRound={true}
        variant="solid"
        background="#744012"
        aria-label="Done"
        fontSize="20px"
        marginLeft="8px"
      />

      {/* hidden hex text  */}
      <Text
        fontSize={14}
        sx={{ lineHeight: "21px" }}
        color="gray"
        display="none"
        className="headerHexText"
      >
        #054849 #8ef08a #0081ec #f9c2f5 #0ae2ff #f5be01 #ff6c37 #744012
      </Text>
    </Box>
  );
}

export default PaletteColors;
