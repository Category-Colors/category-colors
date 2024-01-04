import React from "react";
import { Box, IconButton, Text } from "@chakra-ui/react";
import chipColors from "../../../utils/chipColorsDummyData";

function PaletteColors() {
  return (
    <Box
      flex="5"
      display="flex"
      justifyContent={"flex-start"}
      alignItems={"center"}
      color={"#000000"}
    >
      {chipColors.map((item) => {
        return (
          <IconButton
            key={item.id}
            isRound={true}
            variant="solid"
            background={item.color}
            aria-label="Done"
            fontSize="20px"
            marginLeft="8px"
          />
        );
      })}
      {/* hidden hex text  */}
      <Text
        fontSize={14}
        sx={{ lineHeight: "21px" }}
        color="gray"
        display="none"
        className="headerHexText"
      >
        {chipColors.map((item) => item.color).join(", ")}
      </Text>
    </Box>
  );
}

export default PaletteColors;
