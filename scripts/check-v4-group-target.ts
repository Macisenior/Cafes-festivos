import { loadEnv } from 'vite'
import { doc, getDoc } from 'firebase/firestore'
import {
  connectFirebaseForReadOnly,
  readFirebaseOptionsFromEnvironment,
} from '../src/infrastructure/firebase/firebase-client'
import { V4_GROUPS_COLLECTION } from '../src/infrastructure/firestore/v4-group-records'

const groupId = process.argv[2]
if (!groupId) throw new Error('Indica el groupId V4 que se quiere comprobar.')

const environment = loadEnv('development', process.cwd(), 'VITE_')
const firestore = await connectFirebaseForReadOnly(readFirebaseOptionsFromEnvironment(environment))
const snapshot = await getDoc(doc(firestore, V4_GROUPS_COLLECTION, groupId))

console.log(JSON.stringify({ target: `${V4_GROUPS_COLLECTION}/${groupId}`, exists: snapshot.exists() }, null, 2))
process.exit(0)
