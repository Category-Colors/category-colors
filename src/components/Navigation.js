import {
  Flex,
  Spacer,
  Box,
  Heading,
  ButtonGroup,
  Link,
} from "@chakra-ui/react";
import React from "react";

function Navigation() {
  return (
    <Box gridArea="navbar" bg="white.500">
      <Flex
        minWidth="max-content"
        alignItems="center"
        gap="2"
        mw={"100wv"}
        p={2}
        fontSize={"1rem"}
        borderBottom="1px solid gray"
      >
        <Box>
          <Heading size="sm">Category Colors</Heading>
        </Box>
        <Spacer />
        <ButtonGroup gap="10" mr={4}>
          <Link href="#"> About </Link>
          <Link href="#"> Source </Link>
        </ButtonGroup>
      </Flex>
    </Box>
  );
}

export default Navigation;
