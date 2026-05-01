$file = "c:\Users\user\Desktop\1С бухгалтерия\client-accounting\src\pages\Warehouse.jsx"
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$lines = $content -split "`n"

# Build new content for lines 482-506 (0-indexed: 481-505)
$newBlock = @'
                                    <div className="space-y-4">
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div className="form-group">
                                                <label className="label required">{t('warehouse.so_sklada', 'Со склада')}</label>
                                                <select className="input" value={formData.from_warehouse_id || ''} onChange={(e) => setFormData({ ...formData, from_warehouse_id: e.target.value })} required>
                                                    {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="label required">{t('warehouse.na_sklad', 'На склад')}</label>
                                                <select className="input" value={formData.to_warehouse_id || ''} onChange={(e) => setFormData({ ...formData, to_warehouse_id: e.target.value })} required>
                                                    {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
                                            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label className="label" style={{ margin: 0 }}>Товары для перемещения</label>
                                                <button type="button" className="btn btn-success btn-sm" onClick={() => setTransferItems(prev => [...prev, { product_id: '', quantity: 0 }])} style={{ fontSize: '11px', padding: '4px 10px' }}>+ Добавить товар</button>
                                            </div>
                                            {transferItems.map((item, idx) => (
                                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 36px', gap: '8px', marginBottom: '8px', alignItems: 'end' }}>
                                                    <div className="form-group" style={{ margin: 0 }}>
                                                        {idx === 0 && <label style={{ fontSize: '11px', color: '#888' }}>Товар</label>}
                                                        <select className="input" value={item.product_id} onChange={(e) => { const u = [...transferItems]; u[idx].product_id = e.target.value; setTransferItems(u); }} required>
                                                            <option value="">{t('warehouse.vyberite_tovar', 'Выберите товар')}</option>
                                                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="form-group" style={{ margin: 0 }}>
                                                        {idx === 0 && <label style={{ fontSize: '11px', color: '#888' }}>Кол-во</label>}
                                                        <input type="number" step="0.001" min="0.001" className="input" value={item.quantity || ''} onChange={(e) => { const u = [...transferItems]; u[idx].quantity = parseFloat(e.target.value) || 0; setTransferItems(u); }} placeholder="0" required />
                                                    </div>
                                                    <button type="button" className="btn btn-danger btn-sm" onClick={() => setTransferItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)} style={{ height: '36px', padding: '0 8px' }} disabled={transferItems.length <= 1}>×</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
'@

# Replace lines 482-506 (0-indexed: 481-505) 
$before = $lines[0..480] -join "`n"
$after = $lines[505..($lines.Length-1)] -join "`n"
$result = $before + "`n" + $newBlock + "`n" + $after

[System.IO.File]::WriteAllText($file, $result, [System.Text.Encoding]::UTF8)
Write-Host "Warehouse.jsx patched successfully"
