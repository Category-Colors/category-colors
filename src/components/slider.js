import {
  Slider as SliderChakraUI,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
} from "@chakra-ui/react";

export default function Slider({ number, setNumber }) {
  // event handler that to trigger number state  change
  const handleChange = (value) => {
    setNumber((prev) => {
      if (value < 0) {
        return 0;
      }
      if (value > 100) {
        return 100;
      }
      return value;
    });
  };

  return (
    <SliderChakraUI
      aria-label="slider-ex-1"
      flex="1"
      focusThumbOnChange={false}
      onChange={handleChange}
      defaultValue={0}
      value={number}
      sx={{ width: "210px" }}>
      <SliderTrack>
        <SliderFilledTrack />
      </SliderTrack>
      <SliderThumb />
    </SliderChakraUI>
  );
}
