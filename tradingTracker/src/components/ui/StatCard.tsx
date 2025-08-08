import React from 'react'
import { Card, CardBody } from './Card'

export default function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody>
        <div className="text-gray-400 text-sm">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </CardBody>
    </Card>
  )
}