import Head from "next/head";
import styles from "@component/styles/Home.module.css";
import {
  Box,
  Text,
  Textarea,
  NumberInput,
  NumberInputField,
  FormControl,
  FormLabel,
  Switch,
} from "@chakra-ui/react";

import Accordion from "../components/accordion";
import Slider from "../components/slider";

export default function Home() {
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
        }}>
        <Slider />
        <NumberInput width="20">
          <NumberInputField />
        </NumberInput>
      </div>
      {/* container for toggle and text box */}
      <FormControl
        display="flex"
        alignItems="center"
        sx={{ justifyContent: "space-between", marginBottom: "40px" }}>
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
      <main className={`${styles.main}`}>
        <Accordion
          buttonChildren={buttonChildren}
          panelChildren={panelChildren}
        />
      </main>
    </>
  );
}
