import Head from 'next/head'
import styles from '@component/styles/Home.module.css'
import { Text } from '@chakra-ui/react'

export default function Home() {
  return (
    <>
      <Head>
        <title>Category Colors</title>
        <meta name="description" content="Create accessible color palettes for data visualization" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={`${styles.main}`}>
        <Text>Hello World!</Text>
      </main>
    </>
  )
}
