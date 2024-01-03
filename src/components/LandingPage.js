import React from "react";
import { Grid } from "@chakra-ui/react";
import Navigation from "./Navigation";
import LeftUpperCard from "./LeftUpperCard";
import LeftBottomCard from "./LeftBottomCard";
import PaletteMainCard from "./PaletteMainCard";
import SidebarContainer from "./SidebarContainer";

function LandingPage() {
  return (
    <Grid
      gap={0}
      templateAreas={`"navbar navbar"
      "sidebar main"
      "sidebar main"
              `}
      gridTemplateRows={"4.1% 2fr 50% 0px"}
      gridTemplateColumns={"27% 1fr"}
      color="blackAlpha.700"
      w={"100wh"}
      h={"100vh"}
    >
      <Navigation />

      <SidebarContainer />

      <PaletteMainCard />
    </Grid>
  );
}

export default LandingPage;
