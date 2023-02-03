<?php
/**
 * Copyright © MercadoPago. All rights reserved.
 *
 * @author      Bruno Elisei <brunoelisei@o2ti.com>
 * @license     See LICENSE for license details.
 */

namespace MercadoPago\PaymentMagento\Gateway\Request;

use InvalidArgumentException;
use Magento\Payment\Gateway\Data\PaymentDataObjectInterface;
use Magento\Payment\Gateway\Request\BuilderInterface;
use Magento\Payment\Model\InfoInterface;
use MercadoPago\PaymentMagento\Gateway\Config\Config;
use MercadoPago\PaymentMagento\Gateway\Config\ConfigCc;
use MercadoPago\PaymentMagento\Gateway\SubjectReader;

/**
 * Gateway Requests Payment by Card Data.
 */
class CcPaymentDataRequest implements BuilderInterface
{
    /**
     * Binary Mode block name.
     */
    public const BINARY_MODE = 'binary_mode';

    /**
     * Credit card name block name.
     */
    public const PAYMENT_METHOD_ID = 'payment_method_id';

    /**
     * Payment Method Id block name.
     */
    public const INSTALLMENTS = 'installments';

    /**
     * Soft descriptor.
     */
    public const SOFT_DESCRIPTOR = 'statement_descriptor';

    /**
     * Cc Token block name.
     */
    public const TOKEN = 'token';

    /**
     * Cc Capture block name.
     */
    public const CAPTURE = 'capture';

    /**
     * @var SubjectReader
     */
    protected $subjectReader;

    /**
     * @var Config
     */
    protected $config;

    /**
     * @var ConfigCc
     */
    protected $configCc;

    /**
     * @var array
     */
    protected $notAvailableCapture = [
        'debelo',
        'debvisa',
        'maestro',
        'debcabal',
        'debmaster',
    ];

    /**
     * @param SubjectReader $subjectReader
     * @param Config        $config
     * @param ConfigCc      $configCc
     */
    public function __construct(
        SubjectReader $subjectReader,
        Config $config,
        ConfigCc $configCc
    ) {
        $this->subjectReader = $subjectReader;
        $this->config = $config;
        $this->configCc = $configCc;
    }

    /**
     * Build.
     *
     * @param array $buildSubject
     */
    public function build(array $buildSubject)
    {
        if (!isset($buildSubject['payment'])
            || !$buildSubject['payment'] instanceof PaymentDataObjectInterface
        ) {
            throw new InvalidArgumentException('Payment data object should be provided');
        }

        $paymentDO = $buildSubject['payment'];
        $payment = $paymentDO->getPayment();
        $order = $paymentDO->getOrder();
        $storeId = $order->getStoreId();
        $result = [];

        $result = $this->getDataPaymetCc($payment, $storeId);

        return $result;
    }

    /**
     * Data for CC.
     *
     * @param InfoInterface $payment
     * @param int           $storeId
     *
     * @return array
     */
    public function getDataPaymetCc($payment, $storeId)
    {
        $instruction = [];

        $installment = $payment->getAdditionalInformation('card_installments') ?: 1;
        $ccTypeName = strtolower((string) $payment->getAdditionalInformation('card_type'));
        $capture = $this->configCc->hasCapture($storeId);
        $binary = $this->configCc->isBinaryMode($storeId);

        if (in_array($ccTypeName, $this->notAvailableCapture)) {
            $capture = true;
            $binary = true;
        }

        $instruction = [
            self::INSTALLMENTS      => (int) $installment,
            self::PAYMENT_METHOD_ID => $ccTypeName,
            self::SOFT_DESCRIPTOR   => $this->config->getStatementDescriptor($storeId),
            self::BINARY_MODE       => $binary,
            self::TOKEN             => $payment->getAdditionalInformation('card_number_token'),
            self::CAPTURE           => $capture,
        ];

        return $instruction;
    }
}
