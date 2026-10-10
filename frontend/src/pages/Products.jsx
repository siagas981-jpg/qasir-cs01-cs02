function MasterManager({ table, label }){
  const [items, setItems] = useState([])
  const [name, setName] = useState("")
  const qc = useQueryClient();
  const load = async () => {
    const { data } = await supabase.from(table).select("*").order("created_at", {ascending:false});
    setItems(data||[])
  }
  useEffect(()=>{
    load()
  }, [table])

  const add = async () => {
    if(!name.trim()) return
    const { error } = await supabase.from(table).insert({ name: name.trim() })
    if(error) return toast.error(error.message)
    setName(""); load(); qc.invalidateQueries({queryKey:[table]}); toast.success(`${label} ditambahkan`)
  }
  const del = async (id) => {
    if(!confirm(`Hapus ${label} ini?`)) return
    const { error } = await supabase.from(table).delete().eq("id", id)
    if(error) return toast.error(error.message)
    load(); qc.invalidateQueries({queryKey:[table]}); qc.invalidateQueries({queryKey:["products"]})
  }
  return (
    <div className="bg-white rounded-xl border p-4">
      <h3 className="font-bold mb-3">{label}</h3>
      <div className="flex gap-2 mb-4">
        <Input placeholder={`Nama ${label} baru`} value={name} onChange={e=>setName(e.target.value)} className="h-10" />
        <Button onClick={add} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-1"/>Tambah</Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {items.map(it=>(
          <div key={it.id} className="flex justify-between items-center border rounded-lg px-3 py-2 bg-slate-50">
            <span className="text-sm font-medium truncate">{it.name}</span>
            <button onClick={()=>del(it.id)} className="text-rose-500 hover:text-rose-700 ml-2 p-1"><Trash2 className="h-4 w-4"/></button>
          </div>
        ))}
        {items.length===0 && <p className="text-sm text-slate-400">Belum ada {label}</p>}
      </div>
    </div>
  )
}
