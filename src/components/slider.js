import {
  Slider as SliderChakraUI,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  SliderMark,
} from "@chakra-ui/react";

export default function Slider() {
  return (
    // add styling to the slider
    <SliderChakraUI
      aria-label="slider-ex-1"
      defaultValue={30}
      sx={{ width: "250px" }}>
      <SliderTrack>
        <SliderFilledTrack />
      </SliderTrack>
      <SliderThumb />
    </SliderChakraUI>
  );
}
