// Output an in-memory, generated synthetic P1G to stdout. NEVER read user saves.
import {makeSyntheticP1gProfile} from '../fixture.mjs';
const mib=Number(process.argv[2]??1);
if(!Number.isSafeInteger(mib)||mib<1||mib>24){
 process.stderr.write('Synthetic size must be 1..24 MiB\n');
 process.exitCode=2;
}else{
 const root={GameInfo:{Version:626,InitialVersion:518},Player:{Name:'Synthetic'},
 World:{RecurringEvents:{},SyntheticOpaque:{
  text:'S'.repeat(mib*1024*1024),ordered:[null,false,{id:3},'keep']
 }}};
 process.stdout.write(Buffer.from(makeSyntheticP1gProfile(root)));
}
