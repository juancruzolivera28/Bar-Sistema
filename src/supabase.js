import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://phdhhkoslpjwyvoajixn.supabase.co'
const supabaseKey = 'sb_publishable_QrzkNYF5sVEtL44f_eLv9w_RXwe61tX'

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)