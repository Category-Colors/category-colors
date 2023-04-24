import {
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Accordion as AccordionChakraUI,
} from '@chakra-ui/react'

export default function Accordion({buttonChildren, panelChildren}) {
  return (
    <AccordionChakraUI>
      <AccordionItem>
        <h2>
          <AccordionButton>
            {buttonChildren}
            <AccordionIcon />
          </AccordionButton>
        </h2>
        <AccordionPanel pb={4}>
          {panelChildren}
        </AccordionPanel>
      </AccordionItem>
    </AccordionChakraUI>
  )
}
