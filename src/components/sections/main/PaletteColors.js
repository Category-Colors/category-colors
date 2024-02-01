import React from "react";
import { Box, IconButton, Text } from "@chakra-ui/react";
import chipColorsData from "../../../utils/chipColorsDummyData";

function PaletteColors({ id }) {
  const [palette, setPalette] = React.useState(null);

  React.useEffect(() => {
    setPalette(chipColorsData.find((item) => item.id === id));
  }, [id]);

  if (!palette) return null;

  return (
    <Box
      flex="5"
      display="flex"
      justifyContent={"flex-start"}
      alignItems={"center"}
      color={"#000000"}
    >
      {palette.color.map((item) => {
        return (
          <IconButton
            key={item}
            isRound={true}
            variant="solid"
            background={item}
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
      >
        {palette.color.join(", ")}
      </Text>
    </Box>
  );
}
export default PaletteColors;
