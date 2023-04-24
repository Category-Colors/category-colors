import {
  Slider as SliderChakraUI,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  SliderMark,
} from '@chakra-ui/react'

export default function Slider() {
  return (
    <SliderChakraUI aria-label='slider-ex-1' defaultValue={30}>
      <SliderTrack>
        <SliderFilledTrack />
      </SliderTrack>
      <SliderThumb />
    </SliderChakraUI>
  )
}
