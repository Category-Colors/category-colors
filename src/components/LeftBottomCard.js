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

function LeftBottomCard() {
  const [temp, setTemp] = React.useState({
    startingTemp: 0,
    coolingRate: 0,
    tempCutOff: 0,
  });

  return (
    <Box gridArea="leftBottomCard" p={4} mb={5}>
      <Heading as="h2" size="md" mb={5}>
        Algorithm Parameters
      </Heading>

      <Box>
        <Heading as="h3" size="sm">
          Starting Temperature
        </Heading>
        <Flex justifyContent={"space-between"} mb={6}>
          <Slider
            value={temp.startingTemp}
            handleChange={(val) => {
              setTemp({ ...temp, startingTemp: val });
            }}
          />
          <NumberInput
            width={20}
            min={0}
            max={100}
            ml={5}
            value={temp.startingTemp}
            onChange={(val) => {
              setTemp({
                ...temp,
                startingTemp: val < 0 ? 0 : val > 100 ? 100 : val,
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
        <Heading as="h3" size="sm">
          Cooling Rate
        </Heading>
        <Flex justifyContent={"space-between"} mb={6}>
          <Slider
            value={temp.coolingRate}
            handleChange={(val) => {
              setTemp({ ...temp, coolingRate: val });
            }}
          />
          <NumberInput
            width={20}
            min={0}
            max={100}
            ml={5}
            value={temp.coolingRate}
            onChange={(val) => {
              setTemp({
                ...temp,
                coolingRate: val < 0 ? 0 : val > 100 ? 100 : val,
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
        <Heading as="h3" size="sm">
          Temperature Cut Off
        </Heading>
        <Flex justifyContent={"space-between"} mb={6}>
          <Slider
            value={temp.tempCutOff}
            handleChange={(val) => {
              setTemp({ ...temp, tempCutOff: val });
            }}
          />
          <NumberInput
            width={20}
            min={0}
            max={100}
            ml={5}
            value={temp.tempCutOff}
            onChange={(val) => {
              setTemp({
                ...temp,
                tempCutOff: val < 0 ? 0 : val > 100 ? 100 : val,
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

      <Box
        as="button"
        borderRadius="md"
        bg="#EDF2F7"
        color="#2D3748"
        width={"100%"}
        p={4}
        mt={5}
        fontWeight={"bold"}
      >
        Generate Palette
      </Box>
    </Box>
  );
}

export default LeftBottomCard;
