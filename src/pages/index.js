import Head from 'next/head'
import styles from '@component/styles/Home.module.css'
import { 
  Box,
  Text, 
  Textarea,
  NumberInput,
  NumberInputField,
  FormControl,
  FormLabel,
  Switch,
} from '@chakra-ui/react'

import Accordion from '../components/accordion'
import Slider from '../components/slider'

export default function Home() {

  const buttonChildren = (
    <Box as="span" flex='1' textAlign='left'>
      Panel Title
    </Box>
  )

  const panelChildren = (
    <>
      Slider Title
      <Slider />
      <NumberInput width="20">
        <NumberInputField />
      </NumberInput>
      <FormControl display='flex' alignItems='center'>
        <FormLabel htmlFor='email-alerts' mb='0'>
          Toggle Title
        </FormLabel>
        <Switch id='email-alerts' />
      </FormControl>
      <Text fontSize='md'>Text box title</Text>
      <Textarea placeholder='Here is a sample placeholder' size='sm'/>
    </>
  )

  return (
    <>
      <Head>
        <title>Category Colors</title>
        <meta name="description" content="Create accessible color palettes for data visualization" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={`${styles.main}`}>
        <Accordion buttonChildren={buttonChildren} panelChildren={panelChildren}/>
      </main>
    </>
  )
}
