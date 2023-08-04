import React from "react";
import Slider from "./slider";
import {
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Box,
  Heading,
  Textarea,
  Text,
  Flex,
} from "@chakra-ui/react";

function LeftUpperCard() {
  const [number, setNumber] = React.useState({
    outputColors: 0,
    energy: 0,
    range: 0,
    accessibility: 0,
    similarity: 0,
    targetColors: 0,
  });

  return (
    <Box gridArea="leftUpperCard" borderBottom={"1px solid gray"} p={4}>
      <Heading as="h2" size="md" mb={5}>
        Palette Parameters
      </Heading>

      <Flex justifyContent={"space-between"} flexDirection={"column"} mb={6}>
        <Heading as="h3" size="sm" mb={2}>
          Output Colors
        </Heading>
        <NumberInput
          maxWidth={210}
          width={"100%"}
          min={0}
          max={100}
          value={number.outputColors}
          onChange={(val) => {
            setNumber({
              ...number,
              outputColors: val < 0 ? 0 : val > 100 ? 100 : val,
            });
          }}
        >
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
      </Flex>

      <Box>
        <Heading as="h3" size="sm" mb={2}>
          Energy
        </Heading>
        <Heading as="h6" size="xs" mb={1} color={"gray"}>
          Large values result in greater color differences
        </Heading>
        <Flex justifyContent={"space-between"} mb={6}>
          <Slider
            value={number.energy}
            handleChange={(val) => {
              setNumber({
                ...number,
                energy: val,
              });
            }}
          />
          <NumberInput
            width={20}
            min={0}
            max={100}
            ml={5}
            value={number.energy}
            onChange={(val) => {
              setNumber({
                ...number,
                energy: val < 0 ? 0 : val > 100 ? 100 : val,
              });
            }}
          >
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
        </Flex>
      </Box>

      <Box>
        <Heading as="h3" size="sm" mb={2}>
          Range
        </Heading>
        <Heading as="h6" size="xs" mb={1} color={"gray"}>
          Large values result in greater color distribution
        </Heading>

        <Flex justifyContent={"space-between"} mb={6}>
          <Slider
            value={number.range}
            handleChange={(val) => {
              setNumber({
                ...number,
                range: val,
              });
            }}
          />

          <NumberInput
            width={20}
            min={0}
            max={100}
            ml={5}
            value={number.range}
            onChange={(val) => {
              setNumber({
                ...number,
                range: val < 0 ? 0 : val > 100 ? 100 : val,
              });
            }}
          >
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
        </Flex>
      </Box>

      <Box>
        <Heading as="h3" size="sm" mb={2}>
          Accessibility
        </Heading>
        <Heading as="h6" size="xs" mb={1} color={"gray"}>
          Large values result in more accessible colors
        </Heading>

        <Flex justifyContent={"space-between"} mb={6}>
          <Slider
            value={number.accessibility}
            handleChange={(val) => {
              setNumber({
                ...number,
                accessibility: val,
              });
            }}
          />
          <NumberInput
            width={20}
            min={0}
            max={100}
            ml={5}
            value={number.accessibility}
            onChange={(val) => {
              setNumber({
                ...number,
                accessibility: val < 0 ? 0 : val > 100 ? 100 : val,
              });
            }}
          >
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
        </Flex>
      </Box>

      <Box>
        <Heading as="h3" size="sm" mb={2}>
          Similarity
        </Heading>
        <Heading as="h6" size="xs" mb={1} color={"gray"}>
          Similarity to target Colors
        </Heading>

        <Flex justifyContent={"space-between"} mb={6}>
          <Slider
            value={number.similarity}
            handleChange={(val) => {
              setNumber({
                ...number,
                similarity: val,
              });
            }}
          />
          <NumberInput
            width={20}
            min={0}
            max={100}
            ml={5}
            value={number.similarity}
            onChange={(val) => {
              setNumber({
                ...number,
                similarity: val < 0 ? 0 : val > 100 ? 100 : val,
              });
            }}
          >
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
        </Flex>
      </Box>

      <Box>
        <Text fontSize="md">Target Colors</Text>
        <Textarea
          placeholder="#c0ffee, #123abc, #abc123  "
          size="sm"
          mt={2}
          p={2}
          boxShadow={"0 0 0 2px gray"}
        />
      </Box>
    </Box>
  );
}

export default LeftUpperCard;
