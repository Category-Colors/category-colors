import React, { useState } from "react";
import Head from "next/head";
import styles from "@component/styles/Home.module.css";
import {
  Box,
  Text,
  Textarea,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  FormControl,
  FormLabel,
  Switch,
} from "@chakra-ui/react";

import Accordion from "../components/accordion";
import Slider from "../components/slider";
import LandingPage from "../components/LandingPage";

export default function Home() {
  // state for the number input and slider
  const [number, setNumber] = useState(0);
  // state for the error message
  const [numberError, setNumberError] = useState(0);

  // event handler to trigger number state change
  function handleChange(number) {
    if (number < 0) {
      setNumberError("Number cannot be less than 0");
      return 0;
    }
    if (number > 100) {
      setNumberError("Number cannot be greater than 100");
      return 100;
    }
    setNumberError(false);
    setNumber(number);
    return number;
  }

  const buttonChildren = (
    <Box as="span" flex="1" textAlign="left">
      Panel Title
    </Box>
  );

  const panelChildren = (
    <>
      Slider Title
      {/* container for slider and number input */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",

          marginBottom: "30px",
        }}
      >
        {/* slider */}
        <Slider number={number} setNumber={setNumber} />

        {/* number input */}
        <NumberInput
          width="20"
          min={0}
          max={100}
          value={number}
          onChange={handleChange}>
          <NumberInputField />
          <NumberInputStepper>
            {/* increment and decrement for the slider and number state */}
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
      </div>
      {/* error message if the number is higher or lower than the range */}
      {numberError && (
        <Text color="red" fontSize="sm" marginTop="-30px">
          {numberError}
        </Text>
      )}
      {/* container for toggle and text box  */}
      <FormControl
        display="flex"
        alignItems="center"
        sx={{ justifyContent: "space-between", marginBottom: "40px" }}
      >
        <FormLabel htmlFor="email-alerts" mb="0">
          Toggle Title
        </FormLabel>
        <Switch
          id="email-alerts"
          sx={{
            marginRight: "45px",
            display: "block",
          }}
        />
      </FormControl>
      {/* text box */}
      <Text fontSize="md">Text box title</Text>
      <Textarea
        placeholder="Here is a sample placeholder"
        size="sm"
        sx={{
          marginTop: "10px",
          padding: "10px",
          boxShadow: "0 0 0 2px gray",
        }}
      />
    </>
  );

  return (
    <>
      <Head>
        <title>Category Colors</title>
        <meta
          name="description"
          content="Create accessible color palettes for data visualization"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        {/* <Accordion
          buttonChildren={buttonChildren}
          panelChildren={panelChildren}
        /> */}
        <LandingPage />
      </main>
    </>
  );
}
