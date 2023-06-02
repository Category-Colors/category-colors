import {
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Accordion as AccordionChakraUI,
} from "@chakra-ui/react";

export default function Accordion({ buttonChildren, panelChildren }) {
  return (
    <AccordionChakraUI allowMultiple>
      <AccordionItem>
        <h2>
          <AccordionButton
            sx={{ background: "gray", width: "400px" }}
            _expanded={{ bg: "tomato", color: "#fff" }}>
            {buttonChildren}
          </AccordionButton>
        </h2>
        <AccordionPanel pb={4}>{panelChildren}</AccordionPanel>
      </AccordionItem>
    </AccordionChakraUI>
  );
}
