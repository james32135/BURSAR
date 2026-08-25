import { ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0gfoundation/0g-compute-ts-sdk'
import { config, INFERENCE_ABI } from './config.ts'
import { attestResponse } from './attestor.ts'
import { extractJsonObject, sha256Hex } from './util.ts'

const PROMPT =
  'Extract this payable as JSON only with keys: invoice_number, issue_date, due_date, vendor_name, vendor_email, remittance_usdc_e, description, qty, unit_amount, subtotal, tax, total_usd, currency, payment_rail, payable_kind, chain_note. payment_rail must be usdc.e-16661 if the remittance is a 0x address for USDC.e on 0G, otherwise the named rail (wire, ACH, SEPA, BTC, ETH). payable_kind is invoice, contractor, vendor-payment, subscription, api-bill, agent-expense, or recurring. Do not invent fields.'

export type TeeMlResult = {
  provider: string
  providerUrl: string
  model: string
  onChainModel: string
  teeSigner: string
  chatId: string
  rawResponse: string
  responseHash: string
  originalPostHash: string
  processResponse: boolean | null
  attestation: ReturnType<typeof attestResponse>
  extracted: Record<string, string> | null
  usage: unknown
}

async function fetchSignature(baseUrl: string, chatID: string, model: string) {
  const url = `${baseUrl.replace(/\/$/, '')}/v1/proxy/signature/${chatID}?model=${encodeURIComponent(model)}`
  const res = await fetch(url)
  const body = await res.text()
  let json: { text?: string; signature?: string } | null = null
  try {
    json = JSON.parse(body)
  } catch {
    json = null
  }
  return { status: res.status, json, body }
}

export async function extractInvoicePng(png: Buffer, invoiceHash: string): Promise<TeeMlResult> {
  const rpc = new ethers.JsonRpcProvider(config.rpcUrl)
  const wallet = new ethers.Wallet(config.computePk, rpc)
  const serving = new ethers.Contract(config.inference, INFERENCE_ABI, rpc)
  const svc = await serving.getService(config.visionProvider)
  const providerUrl: string = svc.url
  const onChainModel: string = svc.model
  const teeSigner: string = svc.teeSignerAddress
  if (svc.verifiability !== 'TeeML') throw new Error('vision provider is not TeeML')
  if (!svc.teeSignerAcknowledged) throw new Error('tee signer not acknowledged')

  const broker = await createZGComputeNetworkBroker(wallet)
  await broker.inference.acknowledgeProviderSigner(config.visionProvider)
  const modelId = config.visionModel
  const headers = await broker.inference.getRequestHeaders(config.visionProvider)
  const b64 = png.toString('base64')
  const requestObj = {
    model: modelId,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
        ],
      },
    ],
  }
  const requestBody = JSON.stringify(requestObj)
  const endpoint = `${providerUrl}/v1/proxy/chat/completions`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: headers.Authorization },
    body: requestBody,
  })
  const rawResponse = await res.text()
  if (res.status !== 200) throw new Error(`teeml http ${res.status}: ${rawResponse.slice(0, 400)}`)
  let parsed: { id?: string; usage?: unknown; choices?: { message?: { content?: string } }[] } | null = null
  try {
    parsed = JSON.parse(rawResponse)
  } catch {
    parsed = null
  }
  const chatId = res.headers.get('ZG-Res-Key') || parsed?.id || ''
  if (!chatId) throw new Error('missing chatID')

  let processResponse: boolean | null = null
  try {
    processResponse = await broker.inference.processResponse(
      config.visionProvider,
      chatId,
      parsed?.usage ? JSON.stringify(parsed.usage) : undefined
    )
  } catch {
    processResponse = null
  }

  const sig = await fetchSignature(providerUrl, chatId, onChainModel || modelId)
  if (sig.status !== 200 || !sig.json?.text || !sig.json?.signature) {
    throw new Error(`signature fetch failed: ${sig.status} ${sig.body.slice(0, 200)}`)
  }
  const attestation = attestResponse({
    responseBytes: Buffer.from(rawResponse),
    signedText: sig.json.text,
    signature: sig.json.signature,
    expectedSigner: teeSigner,
    invoiceHash,
  })
  if (!attestation.ok) throw new Error(`attestation fail-closed: ${attestation.reason}`)
  if (processResponse !== true) throw new Error('processResponse is not true; fail-closed')

  const content = parsed?.choices?.[0]?.message?.content || rawResponse
  return {
    provider: config.visionProvider,
    providerUrl,
    model: modelId,
    onChainModel,
    teeSigner,
    chatId,
    rawResponse,
    responseHash: sha256Hex(rawResponse),
    originalPostHash: sha256Hex(requestBody),
    processResponse,
    attestation,
    extracted: extractJsonObject(content),
    usage: parsed?.usage || null,
  }
}
