import {
  Slider as SliderChakraUI,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
} from "@chakra-ui/react";

export default function Slider({ value, handleChange }) {
  return (
    <SliderChakraUI
      aria-label="slider-ex-1"
      flex="1"
      focusThumbOnChange={false}
      onChange={handleChange}
      defaultValue={0}
      min={0}
      max={100}
      value={value}
    >
      <SliderTrack>
        <SliderFilledTrack />
      </SliderTrack>
      <SliderThumb />
    </SliderChakraUI>
  );
}
